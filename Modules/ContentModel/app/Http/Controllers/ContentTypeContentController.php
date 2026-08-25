<?php

declare(strict_types=1);

namespace Modules\ContentModel\Http\Controllers;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\TaxonomyManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\ContentType;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\CustomField;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\Taxonomy;
use ArtisanPackUI\MediaLibrary\Models\Media;
use Carbon\CarbonInterface;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Modules\ContentModel\Models\DynamicContentTerm;
use Modules\ContentModel\Support\SpecializedContentTypes;
use Modules\Media\Support\ImageMediaRule;
use Modules\Users\Models\UserEditorPreference;
use Throwable;

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
    /** Records per page on the dynamic-content index. */
    private const RECORDS_PER_PAGE = 50;

    public function __construct(
        private readonly ContentTypeManager $manager,
        private readonly TaxonomyManager $taxonomyManager,
    ) {}

    public function index(string $contentType): Response
    {
        $type    = $this->resolve($contentType);
        $records = $this->recordsPayload($type);

        return Inertia::render('admin/content-model/DynamicContentIndex', [
            'contentType' => $this->contentTypeSummary($type),
            'records'     => $records['data'],
            'pagination'  => $records['pagination'],
            'fields'      => $this->fieldsPayload($type),
            'newContent'  => [
                'label'          => strtolower(Str::singular($type->name)),
                'hierarchical'   => (bool) ($type->hierarchical ?? false),
                'parentOptions'  => $this->parentOptionsFor($type),
                'templates'      => [],
                'quickCreateUrl' => route('admin.content.quick-create', ['contentType' => $type->slug]),
            ],
        ]);
    }

    /**
     * Quick-create endpoint for the Add New modal (#184). Writes a
     * minimal row using the user-supplied title (+ optional parent for
     * hierarchical types), then redirects to Edit so the visual editor
     * mounts against a real record. Replaces the old auto-draft
     * "Untitled …" stub.
     */
    public function quickCreate(Request $request, string $contentType): RedirectResponse
    {
        $type = $this->resolve($contentType);

        // Mirror `store()` — an editor can reach the modal for a type
        // whose migration hasn't run yet (the Index page auto-opens
        // the modal on `?new=1` unconditionally), so return the same
        // Laravel-shaped error the modal surfaces inline rather than
        // aborting with a raw 500 the Inertia error overlay would catch.
        if (! Schema::hasTable($type->table_name)) {
            return back()->withInput()->withErrors([
                'title' => __('Content type ":slug" has no records table — run the pending migration first.', ['slug' => $type->slug]),
            ]);
        }

        $rules = ['title' => ['required', 'string', 'max:255']];

        $hierarchical = (bool) ($type->hierarchical ?? false)
            && Schema::hasColumn($type->table_name, 'parent_id');

        if ($hierarchical) {
            $rules['parent_id'] = [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists($type->table_name, 'id'),
            ];
        }

        $validated = $request->validate($rules);

        $data = ['title' => $validated['title']];

        if (Schema::hasColumn($type->table_name, 'status')) {
            $data['status'] = 'draft';
        }
        if (Schema::hasColumn($type->table_name, 'author_id')) {
            $data['author_id'] = $request->user()?->id;
        }
        if ($hierarchical) {
            $data['parent_id'] = $validated['parent_id'] ?? null;
        }
        $data = $data + $this->timestampColumns($type->table_name);

        $id = DB::table($type->table_name)->insertGetId($data);

        $this->emitRecordCreated($type->slug, $data, $id);

        return redirect()->route('admin.content.edit', [
            'contentType' => $type->slug,
            'record'      => $id,
        ]);
    }

    /**
     * Full-form record write for content types with custom fields — the
     * generic edit form POSTs here. The Add-New modal uses the leaner
     * {@see quickCreate()} path; both share the missing-table guard and
     * the emit-created-hook tail.
     */
    public function store(Request $request, string $contentType): RedirectResponse
    {
        $type = $this->resolve($contentType);

        if (! Schema::hasTable($type->table_name)) {
            return back()->withInput()->withErrors([
                'title' => __('Content type ":slug" has no records table — run the pending migration first.', ['slug' => $type->slug]),
            ]);
        }

        $data = $this->validatedRecord($request, $this->fieldModels($type), $type, creating: true);

        $data = $data + $this->timestampColumns($type->table_name);
        $id   = DB::table($type->table_name)->insertGetId($data);

        $this->emitRecordCreated($type->slug, $data, $id);

        return redirect()
            ->route('admin.content.index', ['contentType' => $type->slug])
            ->with('success', __(':type record created.', ['type' => $type->name]));
    }

    public function edit(Request $request, string $contentType, int $record): Response
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
            // Per-user editor chrome view mode (issue #239), keyed by the
            // content-type slug so each type remembers its own mode. Only the
            // `view_mode` slice is used on this screen — the panel layout keys
            // ride along but this shell has no reorderable sidebar.
            'editorPreferences' => UserEditorPreference::payloadFor($request->user(), $type->slug),
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

        $data = $this->validatedRecord($request, $this->fieldModels($type), $type, creating: false);

        $hasStatusColumn = Schema::hasColumn($type->table_name, 'status');

        // Wrap column update + term sync in one transaction so a term-sync
        // failure doesn't leave saved metadata paired with stale
        // taxonomy assignments (both persist or neither does).
        //
        // The pre-save status snapshot is captured INSIDE the transaction
        // under `lockForUpdate()` so a concurrent request can't flip the
        // status between the read and our write — that race would
        // otherwise cause `.record.published` to fire (or be suppressed)
        // based on a stale prior value. Threaded back out via `$priorStatus`
        // so the post-commit `.published` emit uses the locked value.
        $priorStatus = null;

        DB::transaction(function () use ($type, $record, $data, $request, $hasStatusColumn, &$priorStatus): void {
            if ($hasStatusColumn) {
                $priorStatus = (string) (DB::table($type->table_name)
                    ->where('id', $record)
                    ->lockForUpdate()
                    ->value('status') ?? '');
            }

            DB::table($type->table_name)
                ->where('id', $record)
                ->update($data + Arr::only($this->timestampColumns($type->table_name), 'updated_at'));

            $this->syncTerms($type, $record, $request->input('term_ids', []));
        });

        doAction('keystone.admin.contentTypes.record.updated', $type->slug, $data, $record);

        $newStatus = (string) ($data['status'] ?? '');
        if ('published' === $newStatus && 'published' !== $priorStatus) {
            doAction('keystone.admin.contentTypes.record.published', $type->slug, $data, $record);
        }

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

        // Snapshot + delete atomically inside the transaction so a
        // concurrent writer can't slip a new row in between the read
        // and the delete. `lockForUpdate()` on the snapshot read holds
        // a row-level lock until the transaction commits, so a
        // concurrent DELETE can't drop the row between the read and
        // our own DELETE — without the lock, `first()` is a
        // non-locking read and the .record.deleted action would fire
        // for a delete that touched zero rows. Also lets us bail out
        // cleanly when the row is already gone.
        $row     = null;
        $deleted = 0;

        DB::transaction(function () use ($type, $record, &$row, &$deleted): void {
            $rowObject = DB::table($type->table_name)
                ->where('id', $record)
                ->lockForUpdate()
                ->first();

            if (null === $rowObject) {
                return;
            }

            $row     = (array) $rowObject;
            $deleted = DB::table($type->table_name)->where('id', $record)->delete();

            DB::table('keystone_dynamic_content_term_assignments')
                ->where('content_type_slug', $type->slug)
                ->where('record_id', $record)
                ->delete();
        });

        // Only fire the deletion event when the row actually went
        // away under our lock. `$deleted === 0` here would indicate a
        // driver quirk (SQLite lock escalation, MySQL isolation edge
        // case) rather than a normal missing-row case — safer to
        // surface it as a validation error than to emit a phantom
        // event.
        if (null === $row || 1 !== $deleted) {
            return back()->withErrors(['id' => __('No record with id ":id" for ":slug".', [
                'id'   => $record,
                'slug' => $type->slug,
            ])]);
        }

        // Fire after the transaction commits so a subscriber exception
        // (or a transaction rollback) doesn't leave subscribers with a
        // phantom "deleted" event; matches the FiresLifecycleHooks trait
        // shape used for Post/Page.
        doAction('keystone.admin.contentTypes.record.deleted', $type->slug, $row, $record);

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
     * @param  bool  $creating  Distinguishes the INSERT path from the UPDATE
     *                          path; only the former may default `author_id`.
     *
     * @return array<string, mixed>
     */
    private function validatedRecord(Request $request, Collection $fields, ContentType $type, bool $creating): array
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
            'featured_image_id' => ImageMediaRule::nullable(),
        ];
        $data = [
            'title'   => (string) $request->input('title', ''),
            'excerpt' => $request->input('excerpt'),
            // `status` is validated `nullable`, but the column is NOT NULL
            // with a `draft` default — and this array always carries the
            // key, so a payload that omitted it wrote a literal NULL and
            // 500'd on the constraint. Mirror the column default instead.
            'status' => $this->normalizeStatus($request->input('status')),
            // Normalized rather than inserted verbatim: this write goes
            // through the query builder, so nothing casts it on the way
            // in. `date` validation accepts `"next tuesday"` and ISO
            // strings with a `Z` offset, both of which MySQL rejects in
            // strict mode — and a value that *is* accepted still drifts
            // from the Post/Page path, where Eloquent's date cast
            // normalizes first.
            'published_at'      => $this->normalizePublishedAt($request->input('published_at')),
            'featured_image_id' => $request->input('featured_image_id'),
        ];

        // Attribution is a privileged edit. The bespoke Post/Page
        // controllers never accept an author field at all, so leaving this
        // generic path open let any editor stamp a record as authored by
        // anyone. Editors get themselves on create and no say on update;
        // admins and site owners can reassign freely.
        if ($this->mayReassignAuthor($request)) {
            $data['author_id'] = $request->input('author_id');
        } elseif ($creating) {
            $data['author_id'] = $request->user()?->id;
        }

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
            $data['published_at'] = now()->toDateTimeString();
        }

        // Return the full validated set (including explicit nulls and
        // empty strings) so users can *clear* excerpts, authors, dates,
        // featured images, and optional custom fields — array_filter'd
        // payloads silently retained the previous DB value.
        return $data;
    }

    /**
     * `created_at` / `updated_at` values for a records table, but only for
     * the ones that table actually has.
     *
     * Every other column on the write path is `Schema::hasColumn`-guarded
     * because a content type's table is whatever `ensureRecordsTable()`
     * provisioned for its `supports` set — or, for a type whose table was
     * hand-migrated, whatever the author wrote. Timestamps were the two
     * that assumed their way in, so a lean table without them failed the
     * INSERT on an unknown column.
     *
     * @return array<string, Carbon>
     */
    private function timestampColumns(string $table): array
    {
        $now     = now();
        $columns = [];

        foreach (['created_at', 'updated_at'] as $column) {
            if (Schema::hasColumn($table, $column)) {
                $columns[$column] = $now;
            }
        }

        return $columns;
    }

    /**
     * Whether the caller is allowed to set `author_id` to somebody else.
     *
     * The route group admits `admin`, `site_owner`, and `editor`; only the
     * first two own attribution.
     */
    private function mayReassignAuthor(Request $request): bool
    {
        $user = $request->user();

        if (null === $user || ! method_exists($user, 'hasRole')) {
            return false;
        }

        return $user->hasRole('admin') || $user->hasRole('site_owner');
    }

    /**
     * Coerce a submitted status to a value the NOT NULL column accepts,
     * mirroring the `draft` default `ensureRecordsTable()` gives it.
     */
    private function normalizeStatus(mixed $value): string
    {
        $status = is_string($value) ? trim($value) : '';

        return '' !== $status ? $status : 'draft';
    }

    /**
     * Parse a submitted date into the app timezone and format it the way
     * the datetime column expects, so the generic path stores exactly what
     * the Eloquent-backed Post/Page path would.
     *
     * Validation has already run `date`, so a parse failure here means a
     * format Carbon accepts but the driver won't — safer to store NULL (a
     * legal value for the column) than to hand the driver a string it will
     * reject with a 500.
     */
    private function normalizePublishedAt(mixed $value): ?string
    {
        if (null === $value || '' === $value) {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value->copy()->setTimezone(config('app.timezone'))->toDateTimeString();
        }

        try {
            return Carbon::parse((string) $value)
                ->setTimezone(config('app.timezone'))
                ->toDateTimeString();
        } catch (Throwable) {
            return null;
        }
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
        return \Modules\Users\Models\User::query()
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
     * Fire the `.record.created` action, plus `.record.published` when
     * the initial write already puts the row in the published state
     * (mirrors the framework's FiresLifecycleHooks trait). Shared by
     * the two write paths — {@see quickCreate()} for the modal and
     * {@see store()} for the full custom-fields form — so the emit
     * logic isn't duplicated.
     *
     * @param  array<string, mixed>  $data
     */
    private function emitRecordCreated(string $slug, array $data, int|string $id): void
    {
        doAction('keystone.admin.contentTypes.record.created', $slug, $data, $id);

        if ('published' === (string) ($data['status'] ?? '')) {
            doAction('keystone.admin.contentTypes.record.published', $slug, $data, $id);
        }
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
     * Parent-picker options for a hierarchical content type. Returns an
     * empty list when the type isn't hierarchical or the table lacks a
     * `parent_id` column, so the modal can just render nothing for
     * flat types.
     *
     * @return list<array{value: int, label: string}>
     */
    private function parentOptionsFor(ContentType $type): array
    {
        if (! (bool) ($type->hierarchical ?? false)) {
            return [];
        }

        if (! Schema::hasTable($type->table_name) || ! Schema::hasColumn($type->table_name, 'parent_id')) {
            return [];
        }

        // Bounded, unlike the index (which paginates): this feeds a native
        // `<select>` in the Add New modal, and a picker with more than a
        // few hundred options is unusable regardless of whether the data
        // is all there. Making it workable at that scale means a
        // type-ahead control, which is its own piece of work.
        //
        // A hierarchical CPT is not guaranteed to also carry a `title`
        // column — the ContentTypes schema tracks the two flags
        // independently. Fall back to id-only ordering and a `#<id>`
        // label when `title` is absent so Index doesn't 500 on a lean
        // hierarchical type.
        $hasTitle = Schema::hasColumn($type->table_name, 'title');
        $columns  = $hasTitle ? ['id', 'title'] : ['id'];

        return DB::table($type->table_name)
            ->orderBy($hasTitle ? 'title' : 'id')
            ->limit(500)
            ->get($columns)
            ->map(fn ($row) => [
                'value' => (int) $row->id,
                'label' => $hasTitle && '' !== (string) ($row->title ?? '')
                    ? (string) $row->title
                    : '#'.$row->id,
            ])
            ->values()
            ->all();
    }

    /**
     * One page of records, plus the metadata the index needs to render
     * page controls.
     *
     * Paginated rather than `limit(200)`: a truncated list looks exactly
     * like a complete one, so record 201 and everything after it simply
     * had no edit link anywhere in the admin. There is no "show all"
     * escape hatch for the same reason the cap existed — the payload is
     * serialized into the Inertia page prop.
     *
     * @return array{
     *     data: list<array<string, mixed>>,
     *     pagination: array{current_page: int, last_page: int, per_page: int, total: int, prev_url: string|null, next_url: string|null},
     * }
     */
    private function recordsPayload(ContentType $type): array
    {
        if (! Schema::hasTable($type->table_name)) {
            return [
                'data'       => [],
                'pagination' => [
                    'current_page' => 1,
                    'last_page'    => 1,
                    'per_page'     => self::RECORDS_PER_PAGE,
                    'total'        => 0,
                    'prev_url'     => null,
                    'next_url'     => null,
                ],
            ];
        }

        $paginator = DB::table($type->table_name)
            ->orderByDesc('id')
            ->paginate(self::RECORDS_PER_PAGE)
            // Keeps any future filter/search parameters on the page links
            // instead of silently resetting them at the page boundary.
            ->withQueryString();

        return [
            // Mirror the edit-page allowlist so plugin-added sensitive
            // columns (audit trails, encrypted secret refs, etc.) never
            // reach the index Inertia payload either.
            'data' => array_map(
                fn ($row) => $this->recordAllowlist((array) $row, $type),
                $paginator->items(),
            ),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
                'prev_url'     => $paginator->previousPageUrl(),
                'next_url'     => $paginator->nextPageUrl(),
            ],
        ];
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
