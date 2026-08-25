<?php

declare(strict_types=1);

namespace Modules\ContentModel\Http\Controllers;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;
use Modules\ContentModel\Http\Requests\ContentTypeRequest;
use Modules\ContentModel\Support\ContentTypeTables;
use RuntimeException;
use Throwable;

/**
 * Admin CRUD for content types. Wraps
 * `ContentTypes\Managers\ContentTypeManager` directly (same pattern as
 * ThemeController/PluginController — Keystone never routes admin
 * traffic through the framework's `/api/v1/content-types` JSON API,
 * which is only `auth`-gated).
 *
 * The index endpoint lists both DB-persisted types (editable) and
 * filter/plugin-registered types (read-only) so admins can see the full
 * set of registered content types without a plugin having to expose an
 * extra surface. Rows are distinguished by the `is_editable` flag; the
 * UI badges the read-only ones.
 *
 * `table_name` and `model_class` — required inputs on the framework's
 * own request — are derived server-side from the slug and a generic
 * dynamic-content model, so the admin UI can offer a lean form focused
 * on the fields an editor actually cares about.
 */
class ContentTypeController extends Controller
{
    public function __construct(private readonly ContentTypeManager $manager) {}

    public function index(): Response
    {
        return Inertia::render('admin/content-model/ContentTypes', [
            'contentTypes'    => $this->contentTypesPayload(),
            'supportsOptions' => ContentTypeRequest::supportsOptions(),
            'iconOptions'     => ContentTypeRequest::iconOptions(),
        ]);
    }

    public function store(ContentTypeRequest $request): RedirectResponse
    {
        $data = $request->validated();
        /** @var string $slug */
        $slug = $data['slug'];

        $tableName = ContentTypeTables::derive($slug);
        // Framework's CustomFieldManager mutates $type->table_name during
        // custom-field creation, so we need a real table. Rely on the
        // consumer-side migration + a placeholder create migration; for
        // now, we scaffold a lightweight table on demand at first insert.
        // Persist the type first — creation is idempotent enough that a
        // failed table-scaffold can be re-tried.
        $payload = array_merge($data, [
            'table_name'  => $tableName,
            'model_class' => ContentTypeRequest::defaultModelClass(),
            'supports'    => $data['supports'] ?? [],
        ]);

        // Two-phase create with compensation: persist the type first,
        // then provision its data table. If the table build fails, undo
        // the metadata insert so the admin can retry without seeing a
        // ghost content type in the index that has no backing store.
        $type = null;
        try {
            $type = $this->manager->createContentType($payload);
            $this->ensureRecordsTable($tableName, $payload['supports'], $slug);
        } catch (Throwable $e) {
            report($e);

            if (null !== $type) {
                try {
                    $this->manager->deleteContentType($type->slug);
                } catch (Throwable $rollbackError) {
                    // Report but don't overwrite the user-visible error
                    // — the original failure is what the admin needs to
                    // see; the compensation attempt is just cleanup.
                    report($rollbackError);
                }
            }

            return back()
                ->withInput()
                ->withErrors(['slug' => __('Failed to create content type.')]);
        }

        doAction('keystone.admin.contentTypes.contentType.created', $type);

        return redirect()
            ->route('admin.content-model.content-types.index')
            ->with('success', __('Content type ":name" created.', ['name' => $type->name]));
    }

    public function edit(string $contentType): Response
    {
        $type = $this->manager->getPersistedContentType($contentType);

        abort_if(null === $type, 404);

        return Inertia::render('admin/content-model/ContentTypeEdit', [
            'contentType'     => $this->rowPayload($type->toArray(), true),
            'supportsOptions' => ContentTypeRequest::supportsOptions(),
            'iconOptions'     => ContentTypeRequest::iconOptions(),
        ]);
    }

    public function update(ContentTypeRequest $request, string $contentType): RedirectResponse
    {
        $type = $this->manager->getPersistedContentType($contentType);

        if (null === $type) {
            return back()->withErrors(['slug' => __('Content type ":slug" is not editable.', ['slug' => $contentType])]);
        }

        $data = $request->validated();
        // slug + table_name + model_class stay stable across updates. An
        // admin who wants to rename should delete + re-create so
        // `addColumnToTable` gets a clean shot at the fresh table name.
        unset($data['slug'], $data['table_name'], $data['model_class']);
        $data['supports'] = $data['supports'] ?? [];

        try {
            $updated = $this->manager->updateContentType($contentType, $data);
            // Also add columns for any newly-checked supports so the
            // record editor's Featured Image / Excerpt / etc. sections
            // have somewhere to write. Existing columns are never
            // dropped.
            $this->ensureRecordsTable($updated->table_name, $data['supports'], $updated->slug);
        } catch (Throwable $e) {
            report($e);

            return back()
                ->withInput()
                ->withErrors(['slug' => __('Failed to update content type.')]);
        }

        doAction('keystone.admin.contentTypes.contentType.updated', $updated);

        return redirect()
            ->route('admin.content-model.content-types.index')
            ->with('success', __('Content type ":name" updated.', ['name' => $updated->name]));
    }

    public function destroy(string $contentType): RedirectResponse
    {
        $type = $this->manager->getPersistedContentType($contentType);

        if (null === $type) {
            return back()->withErrors(['slug' => __('Content type ":slug" cannot be removed.', ['slug' => $contentType])]);
        }

        try {
            $this->manager->deleteContentType($contentType);
        } catch (Throwable $e) {
            report($e);

            return back()->withErrors(['slug' => __('Failed to delete content type.')]);
        }

        // Fire after the manager call succeeds — a pre-delete emit would
        // hand subscribers a phantom "deleted" event on a row that still
        // exists if the manager throws. `$type` is the pre-delete
        // snapshot so subscribers still get the full payload.
        doAction('keystone.admin.contentTypes.contentType.deleted', $type);

        return redirect()
            ->route('admin.content-model.content-types.index')
            ->with('success', __('Content type ":name" removed.', ['name' => $type->name]));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function contentTypesPayload(): array
    {
        $rows = [];

        foreach ($this->manager->getRegisteredContentTypes() as $slug => $entry) {
            if (! is_array($entry)) {
                continue;
            }

            // Filter-registered entries may skip `slug`; fall back to the
            // array key so the UI always has a stable identifier.
            $entry['slug'] = (string) ($entry['slug'] ?? $slug);
            $rows[]        = $this->rowPayload($entry, isset($entry['id']));
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $entry
     *
     * @return array<string, mixed>
     */
    private function rowPayload(array $entry, bool $isEditable): array
    {
        return [
            'id'            => $entry['id'] ?? null,
            'slug'          => (string) ($entry['slug'] ?? ''),
            'name'          => (string) ($entry['name'] ?? $entry['slug'] ?? ''),
            'description'   => (string) ($entry['description'] ?? ''),
            'icon'          => (string) ($entry['icon'] ?? ''),
            'menu_position' => isset($entry['menu_position']) ? (int) $entry['menu_position'] : null,
            'public'        => (bool) ($entry['public'] ?? true),
            'show_in_admin' => (bool) ($entry['show_in_admin'] ?? true),
            'hierarchical'  => (bool) ($entry['hierarchical'] ?? false),
            'has_archive'   => (bool) ($entry['has_archive'] ?? true),
            'archive_slug'  => (string) ($entry['archive_slug'] ?? ''),
            'supports'      => is_array($entry['supports'] ?? null) ? array_values($entry['supports']) : [],
            'table_name'    => (string) ($entry['table_name'] ?? ''),
            'model_class'   => (string) ($entry['model_class'] ?? ''),
            'is_editable'   => $isEditable,
        ];
    }

    /**
     * Ensure the base records table exists so admins can immediately
     * create records against a freshly-defined content type without
     * dropping to the command line. Adds columns for the plain-scalar
     * `supports` features (`title`, `editor`, `excerpt`) so the
     * matching form fields on DynamicContentEdit have somewhere to
     * write — `editor` maps to the record table's `content` column,
     * matching the framework's SupportsFeature vocabulary. Richer
     * supports (`featured_image`, `author`, `revisions`,
     * `page_attributes`) need pivots or dedicated tables and are left
     * as follow-up work.
     *
     * `hasTable` short-circuits so re-running against an already-migrated
     * table is idempotent (matters if a user restores a content-type row
     * on top of an existing table).
     *
     * Ownership is claimed BEFORE any DDL runs, and a failed claim aborts
     * the whole operation. Validation's {@see ContentTypeTables::claimableBy()}
     * is a read, so two concurrent creates for slugs deriving the same
     * table both pass it; the claim is what actually arbitrates, and
     * provisioning after it means the loser never touches a table it does
     * not own. `store()`'s existing compensation unwinds the content-type
     * row when this throws.
     *
     * @param  list<string>  $supports
     *
     * @throws RuntimeException when another content type owns the table.
     */
    private function ensureRecordsTable(string $tableName, array $supports, string $slug): void
    {
        if (! ContentTypeTables::claim($slug, $tableName)) {
            throw new RuntimeException(sprintf(
                'Table "%s" is already owned by content type "%s".',
                $tableName,
                (string) ContentTypeTables::ownerSlug($tableName),
            ));
        }

        if (! Schema::hasTable($tableName)) {
            Schema::create($tableName, function (Blueprint $table): void {
                $table->id();
                $table->string('title')->nullable();
                $table->string('status', 32)->default('draft');
                $table->timestamp('published_at')->nullable();
                $table->timestamps();
            });
        }

        // Additive schema management: never drop columns (may hold user
        // data); add the ones our supported features expect. Also runs
        // when the framework's `deleteContentType()` left the data table
        // behind and the admin recreated the type with the same slug —
        // otherwise the recreated type inherits the old lean schema and
        // the visual editor 500s writing to a missing `content` column.
        Schema::table($tableName, function (Blueprint $table) use ($tableName, $supports): void {
            if (! Schema::hasColumn($tableName, 'title')) {
                $table->string('title')->nullable();
            }
            if (! Schema::hasColumn($tableName, 'status')) {
                $table->string('status', 32)->default('draft');
            }
            if (! Schema::hasColumn($tableName, 'published_at')) {
                $table->timestamp('published_at')->nullable();
            }
            if (in_array('editor', $supports, true) && ! Schema::hasColumn($tableName, 'content')) {
                $table->longText('content')->nullable();
            }
            if (in_array('excerpt', $supports, true) && ! Schema::hasColumn($tableName, 'excerpt')) {
                $table->text('excerpt')->nullable();
            }
            if (in_array('featured_image', $supports, true) && ! Schema::hasColumn($tableName, 'featured_image_id')) {
                // FK-less: media rows can disappear (delete from library)
                // and cascading the record with them is not the desired
                // behavior. Controller nulls the id if media goes away.
                $table->unsignedBigInteger('featured_image_id')->nullable();
            }
            if (in_array('author', $supports, true) && ! Schema::hasColumn($tableName, 'author_id')) {
                $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            }
        });
    }
}
