<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\ContentModel;

use App\Http\Controllers\Controller;
use App\Models\DynamicContentTerm;
use App\Support\ContentModel\SpecializedContentTypes;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\TaxonomyManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\ContentType;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\CustomField;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\Taxonomy;
use ArtisanPackUI\MediaLibrary\Models\Media;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Generic admin CRUD for records of any registered content type
 * (#106). Resolves the content type via `ContentTypeManager` — same
 * registration surface used by the framework and plugins — and
 * operates directly on `$contentType->table_name` via the DB facade
 * rather than requiring every content type to ship a bespoke Eloquent
 * class and controller.
 *
 * `post` and `page` keep their hardcoded specialized controllers
 * (visual editor + featured image); this controller handles everything
 * else. The two reserved slugs are rejected at the route entry so an
 * admin can't accidentally shadow the specialized UIs.
 *
 * Design (per issue #106): the generic edit form is driven by the
 * content type's registered custom fields. Content types without
 * custom fields get a single `title`-only form so admins can at least
 * create/label rows.
 */
class ContentTypeContentController extends Controller
{
    public function __construct(
        private readonly ContentTypeManager $manager,
        private readonly TaxonomyManager $taxonomyManager,
    ) {}

    public function index(string $contentType): Response
    {
        $type = $this->resolve($contentType);

        return Inertia::render('admin/content-model/DynamicContentIndex', [
            'contentType' => $this->contentTypeSummary($type),
            'records'     => $this->recordsPayload($type),
            'fields'      => $this->fieldsPayload($type),
        ]);
    }

    public function create(Request $request, string $contentType): RedirectResponse
    {
        $type = $this->resolve($contentType);

        // Auto-draft: create a stub row and redirect to edit so the
        // visual editor mounts immediately. Same pattern PostController
        // and PageController use — an empty new-record screen is a
        // dead end when the whole point is the block editor.
        abort_unless(Schema::hasTable($type->table_name), 500, sprintf('Records table "%s" does not exist.', $type->table_name));

        $data = ['title' => 'Untitled '.Str::singular($type->name)];
        if (Schema::hasColumn($type->table_name, 'status')) {
            $data['status'] = 'draft';
        }
        if (Schema::hasColumn($type->table_name, 'author_id')) {
            $data['author_id'] = $request->user()?->id;
        }
        $data['created_at'] = now();
        $data['updated_at'] = now();

        $id = DB::table($type->table_name)->insertGetId($data);

        return redirect()->route('admin.content.edit', [
            'contentType' => $type->slug,
            'record'      => $id,
        ]);
    }

    public function store(Request $request, string $contentType): RedirectResponse
    {
        // With auto-draft in place the create flow always lands on
        // edit; `store` stays here to catch stray POSTs and route them
        // through the same edit-shaped update path.
        $type = $this->resolve($contentType);

        if (! Schema::hasTable($type->table_name)) {
            return back()->withInput()->withErrors([
                'title' => __('Content type ":slug" has no records table — run the pending migration first.', ['slug' => $type->slug]),
            ]);
        }

        $data = $this->validatedRecord($request, $this->fieldModels($type), $type);

        DB::table($type->table_name)->insert($data + [
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return redirect()
            ->route('admin.content.index', ['contentType' => $type->slug])
            ->with('success', __(':type record created.', ['type' => $type->name]));
    }

    public function edit(string $contentType, int $record): Response
    {
        $type = $this->resolve($contentType);

        abort_unless(Schema::hasTable($type->table_name), 404);

        $rowObject = DB::table($type->table_name)->where('id', $record)->first();
        abort_if(null === $rowObject, 404);

        /** @var array<string, mixed> $row */
        $row = (array) $rowObject;

        return Inertia::render('admin/content-model/DynamicContentEdit', [
            'contentType'     => $this->contentTypeSummary($type),
            'fields'          => $this->fieldsPayload($type),
            'taxonomies'      => $this->taxonomiesPayload($type),
            'terms'           => $this->termsForTaxonomies($type),
            'assignedTermIds' => $this->assignedTermIds($type->slug, $record),
            'featuredImage'   => $this->featuredImagePayload($row),
            'authors'         => $this->authorOptions(),
            'statuses'        => $this->statusOptions(),
            'record'          => $this->recordAllowlist($row, $type),
        ]);
    }

    public function update(Request $request, string $contentType, int $record): RedirectResponse
    {
        $type = $this->resolve($contentType);

        abort_unless(Schema::hasTable($type->table_name), 404);
        // findOrFail-style — better than update-and-check-affected,
        // because MySQL returns 0 affected rows if nothing changed even
        // when the id is valid.
        abort_unless(DB::table($type->table_name)->where('id', $record)->exists(), 404);

        $data = $this->validatedRecord($request, $this->fieldModels($type), $type);

        // Wrap column update + term sync in one transaction so a term-sync
        // failure doesn't leave saved metadata paired with stale
        // taxonomy assignments (both persist or neither does).
        DB::transaction(function () use ($type, $record, $data, $request): void {
            DB::table($type->table_name)
                ->where('id', $record)
                ->update($data + ['updated_at' => now()]);

            $this->syncTerms($type, $record, $request->input('term_ids', []));
        });

        return redirect()
            ->route('admin.content.edit', ['contentType' => $type->slug, 'record' => $record])
            ->with('success', __('Saved.'));
    }

    public function destroy(string $contentType, int $record): RedirectResponse
    {
        $type = $this->resolve($contentType);

        if (! Schema::hasTable($type->table_name)) {
            return back()->withErrors(['id' => __('No records table for ":slug".', ['slug' => $type->slug])]);
        }

        DB::transaction(function () use ($type, $record): void {
            DB::table($type->table_name)->where('id', $record)->delete();
            DB::table('keystone_dynamic_content_term_assignments')
                ->where('content_type_slug', $type->slug)
                ->where('record_id', $record)
                ->delete();
        });

        return redirect()
            ->route('admin.content.index', ['contentType' => $type->slug])
            ->with('success', __(':type record removed.', ['type' => $type->name]));
    }

    /**
     * Resolve the URL's `{contentType}` slug to a persisted content
     * type. Uses `getPersistedContentType()` — the DB-only lookup — so
     * a filter-registered payload can never supply a spoofed
     * `table_name` that would then be piped into DB::table() below
     * (writing to `users`, `plugins`, etc.). Filter-registered types
     * are read-only anyway; if a plugin wants a dynamic-content edit
     * screen it must persist a DB row.
     */
    private function resolve(string $slug): ContentType
    {
        if (SpecializedContentTypes::contains($slug)) {
            abort(404);
        }

        $type = $this->manager->getPersistedContentType($slug);
        abort_if(null === $type, 404);

        return $type;
    }

    /**
     * @param  Collection<int, CustomField>  $fields
     *
     * @return array<string, mixed>
     */
    private function validatedRecord(Request $request, Collection $fields, ContentType $type): array
    {
        // NOTE: `content` is deliberately NOT written here. The visual
        // editor (#111) owns the `content` column and stores block JSON
        // through `/visual-editor/api/{slug}/{id}/content`. If we wrote
        // an empty string from this form the editor's saved blocks
        // would be blown away on every metadata save.
        $rules = [
            'title'             => ['nullable', 'string', 'max:255'],
            'excerpt'           => ['nullable', 'string'],
            'status'            => ['nullable', \Illuminate\Validation\Rule::in(array_column($this->statusOptions(), 'value'))],
            'published_at'      => ['nullable', 'date'],
            'author_id'         => ['nullable', 'integer', \Illuminate\Validation\Rule::exists('users', 'id')],
            'featured_image_id' => ['nullable', 'integer'],
        ];
        $data = [
            'title'             => (string) $request->input('title', ''),
            'excerpt'           => $request->input('excerpt'),
            'status'            => $request->input('status'),
            'published_at'      => $request->input('published_at'),
            'author_id'         => $request->input('author_id'),
            'featured_image_id' => $request->input('featured_image_id'),
        ];

        foreach ($fields as $field) {
            $key         = 'values.'.$field->key;
            $rules[$key] = $this->rulesForCustomField($field);
            /** @var mixed $rawValue */
            $rawValue          = $request->input($key);
            $data[$field->key] = $this->normalizeCustomFieldValue($field, $rawValue);
        }

        $request->validate($rules);

        // Drop columns that don't exist on this content type's table so
        // an INSERT/UPDATE against a lean schema doesn't fail on
        // Unknown column. `content_types_manager::supports` decides which
        // columns `ensureRecordsTable` created for this type.
        $tableColumns = Schema::getColumnListing($type->table_name);
        $data         = array_intersect_key($data, array_flip($tableColumns));

        // `published_at` is nullable-timestamped, so publishing without
        // an explicit date auto-fills now(). Consistent with Post/Page.
        if (($data['status'] ?? null) === 'published' && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        // Return the full validated set (including explicit nulls and
        // empty strings) so users can *clear* excerpts, authors, dates,
        // featured images, and optional custom fields — array_filter'd
        // payloads silently retained the previous DB value.
        return $data;
    }

    /**
     * Explicit column allowlist for the Inertia `record` prop. Anything
     * a plugin migration might have added to the target table (audit
     * columns, encrypted secret refs, etc.) is stripped before it
     * reaches the browser — the raw `(array) $row` used to dump the
     * whole table shape into the JSON payload.
     *
     * @param  array<string, mixed>  $row
     *
     * @return array<string, mixed>
     */
    private function recordAllowlist(array $row, ContentType $type): array
    {
        $allowlist = [
            'id', 'title', 'status', 'published_at', 'excerpt',
            'content', 'featured_image_id', 'author_id',
            'created_at', 'updated_at',
        ];
        foreach ($type->getCustomFields() as $field) {
            if ($field instanceof CustomField && '' !== (string) $field->key) {
                $allowlist[] = $field->key;
            }
        }

        return array_intersect_key($row, array_flip($allowlist));
    }

    /**
     * Rules for a custom field's value, keyed by the field's `type`
     * slug. Falls back to `required|nullable + string` for anything the
     * dispatch table doesn't recognize so plugin field types still
     * validate as free-form text rather than 500-ing.
     *
     * @return list<mixed>
     */
    private function rulesForCustomField(CustomField $field): array
    {
        $rules = [$field->required ? 'required' : 'nullable'];
        $type  = (string) $field->type;

        if ('integer' === $type) {
            // `numeric` accepts 1.5 — an integer DB column would then
            // silently truncate or reject on save. `integer` enforces
            // whole numbers up front.
            $rules[] = 'integer';
        } elseif ('number' === $type) {
            $rules[] = 'numeric';
        } elseif (in_array($type, ['boolean', 'checkbox'], true)) {
            $rules[] = 'boolean';
        } elseif (in_array($type, ['date'], true)) {
            $rules[] = 'date_format:Y-m-d';
        } elseif (in_array($type, ['datetime'], true)) {
            $rules[] = 'date';
        } elseif (in_array($type, ['time'], true)) {
            $rules[] = 'date_format:H:i';
        } elseif ('email' === $type) {
            $rules[] = 'email';
        } elseif ('url' === $type) {
            $rules[] = 'url';
        } elseif ('select' === $type || 'radio' === $type) {
            $rules[] = 'string';
            $choices = $this->selectChoices($field);
            if (! empty($choices)) {
                $rules[] = \Illuminate\Validation\Rule::in($choices);
            }
        } else {
            $rules[] = 'string';
        }

        return $rules;
    }

    /**
     * Coerce the raw request value to the shape the DB column expects.
     * `array_intersect_key` in the caller drops any key whose column
     * isn't on the target table, so this only runs for real columns.
     */
    private function normalizeCustomFieldValue(CustomField $field, mixed $raw): mixed
    {
        if (null === $raw) {
            return null;
        }
        $type = (string) $field->type;

        if (in_array($type, ['boolean', 'checkbox'], true)) {
            return filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }
        if ('integer' === $type) {
            $int = filter_var($raw, FILTER_VALIDATE_INT);

            return false === $int ? null : $int;
        }
        if ('number' === $type) {
            return is_numeric($raw) ? $raw + 0 : null;
        }

        return $raw;
    }

    /**
     * @return list<string>
     */
    private function selectChoices(CustomField $field): array
    {
        $options = is_array($field->options) ? $field->options : [];
        $choices = $options['choices'] ?? $options['options'] ?? [];
        if (! is_array($choices)) {
            return [];
        }

        return array_values(array_map('strval', array_map(
            fn ($choice) => is_array($choice) ? ($choice['value'] ?? $choice['label'] ?? '') : $choice,
            $choices,
        )));
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return [
            ['value' => 'draft',     'label' => 'Draft'],
            ['value' => 'published', 'label' => 'Published'],
        ];
    }

    /**
     * @return list<array{id: int, label: string}>
     */
    private function authorOptions(): array
    {
        // Deliberately NOT falling back to `email` when display_name is
        // empty. Editors are gated out of /admin/users; this dropdown
        // would otherwise become the only surface where they can see
        // every registered user's email address. `#<id>` is the safe
        // fallback until the framework grows a "gravatar-safe display
        // label" resolver.
        return \App\Models\User::query()
            ->orderBy('display_name')
            ->limit(200)
            ->get(['id', 'display_name'])
            ->map(fn ($u) => [
                'id'    => (int) $u->id,
                'label' => '' !== (string) $u->display_name ? $u->display_name : '#'.$u->id,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $row
     *
     * @return array<string, mixed>|null
     */
    private function featuredImagePayload(array $row): ?array
    {
        $id = $row['featured_image_id'] ?? null;
        if (! is_numeric($id)) {
            return null;
        }

        $media = Media::query()->find((int) $id);
        if (null === $media) {
            return null;
        }

        return [
            'id'        => (int) $media->id,
            'url'       => (string) ($media->url ?? $media->file_path ?? ''),
            'alt_text'  => (string) ($media->alt_text ?? ''),
            'title'     => (string) ($media->title ?? ''),
            // FeaturedImagePicker keys its preview render off mime_type
            // (image/* → <img>, everything else → filename badge).
            'mime_type' => (string) ($media->mime_type ?? ''),
        ];
    }

    /**
     * Terms grouped by taxonomy slug, for the sidebar term picker.
     *
     * @return array<string, list<array{id: int, name: string}>>
     */
    private function termsForTaxonomies(ContentType $type): array
    {
        $taxonomySlugs = $this->taxonomyManager
            ->getTaxonomiesForContentType($type->slug)
            ->pluck('slug')
            ->all();

        if (empty($taxonomySlugs)) {
            return [];
        }

        $grouped = [];
        foreach ($taxonomySlugs as $slug) {
            $grouped[$slug] = DynamicContentTerm::query()
                ->where('taxonomy_slug', $slug)
                ->orderBy('name')
                ->get(['id', 'name'])
                ->map(fn ($t) => ['id' => (int) $t->id, 'name' => (string) $t->name])
                ->values()
                ->all();
        }

        return $grouped;
    }

    /**
     * @return list<int>
     */
    private function assignedTermIds(string $slug, int $recordId): array
    {
        return DB::table('keystone_dynamic_content_term_assignments')
            ->where('content_type_slug', $slug)
            ->where('record_id', $recordId)
            ->pluck('term_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Replace this record's term assignments to exactly the given ids,
     * ignoring any id that isn't a real term row (defensive; the form
     * only sends server-supplied ids, but a hostile POST could
     * fabricate them).
     *
     * @param  array<int, mixed>|mixed  $termIds
     */
    private function syncTerms(ContentType $type, int $recordId, mixed $termIds): void
    {
        $ids = collect(is_array($termIds) ? $termIds : [])
            ->map(fn ($v) => (int) $v)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        // Constrain to terms whose taxonomy is actually bound to this
        // content type — otherwise an editor could POST a Region term
        // id onto a Booking record and end up with cross-taxonomy junk
        // in the pivot that the sidebar (termsForTaxonomies) doesn't
        // even render.
        $boundTaxonomySlugs = $this->taxonomyManager
            ->getTaxonomiesForContentType($type->slug)
            ->pluck('slug')
            ->all();

        $validIds = DynamicContentTerm::query()
            ->whereIn('id', $ids)
            ->whereIn('taxonomy_slug', $boundTaxonomySlugs)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        DB::transaction(function () use ($type, $recordId, $validIds): void {
            DB::table('keystone_dynamic_content_term_assignments')
                ->where('content_type_slug', $type->slug)
                ->where('record_id', $recordId)
                ->delete();

            if (empty($validIds)) {
                return;
            }

            $rows = array_map(fn (int $termId) => [
                'content_type_slug' => $type->slug,
                'record_id'         => $recordId,
                'term_id'           => $termId,
                'created_at'        => now(),
                'updated_at'        => now(),
            ], $validIds);

            DB::table('keystone_dynamic_content_term_assignments')->insert($rows);
        });
    }

    /**
     * @return Collection<int, CustomField>
     */
    private function fieldModels(ContentType $type): Collection
    {
        return $type->getCustomFields();
    }

    /**
     * @return array<string, mixed>
     */
    private function contentTypeSummary(ContentType $type): array
    {
        $hasTable = Schema::hasTable($type->table_name);
        $columns  = $hasTable ? Schema::getColumnListing($type->table_name) : [];

        return [
            'slug'        => $type->slug,
            'name'        => $type->name,
            'description' => (string) ($type->description ?? ''),
            'table_name'  => $type->table_name,
            'has_table'   => $hasTable,
            'supports'    => is_array($type->supports) ? array_values($type->supports) : [],
            // Column existence tells the frontend which controls to
            // render — a `supports` flag doesn't guarantee the matching
            // column was actually provisioned (an older table may
            // predate the additive migration).
            'has_column'  => [
                'status'            => in_array('status', $columns, true),
                'published_at'      => in_array('published_at', $columns, true),
                'excerpt'           => in_array('excerpt', $columns, true),
                'content'           => in_array('content', $columns, true),
                'featured_image_id' => in_array('featured_image_id', $columns, true),
                'author_id'         => in_array('author_id', $columns, true),
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recordsPayload(ContentType $type): array
    {
        if (! Schema::hasTable($type->table_name)) {
            return [];
        }

        // Mirror the edit-page allowlist so plugin-added sensitive
        // columns (audit trails, encrypted secret refs, etc.) never
        // reach the index Inertia payload either.
        return DB::table($type->table_name)
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn ($row) => $this->recordAllowlist((array) $row, $type))
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fieldsPayload(ContentType $type): array
    {
        return $type->getCustomFields()->map(fn (CustomField $field) => [
            'name'          => $field->name,
            'key'           => $field->key,
            'type'          => $field->type,
            'required'      => (bool) $field->required,
            'default_value' => (string) ($field->default_value ?? ''),
            'options'       => is_array($field->options) ? $field->options : [],
        ])->values()->all();
    }

    /**
     * Taxonomies bound to this content type. Rendered on the edit form
     * so admins can see which classifications apply. Term assignment is
     * a follow-up — the framework doesn't ship a Keystone-side
     * record-to-term pivot for dynamic content types today.
     *
     * @return list<array<string, mixed>>
     */
    private function taxonomiesPayload(ContentType $type): array
    {
        return $this->taxonomyManager->getTaxonomiesForContentType($type->slug)
            ->map(fn (Taxonomy $taxonomy) => [
                'slug'         => $taxonomy->slug,
                'name'         => $taxonomy->name,
                'hierarchical' => (bool) $taxonomy->hierarchical,
            ])
            ->values()
            ->all();
    }
}
