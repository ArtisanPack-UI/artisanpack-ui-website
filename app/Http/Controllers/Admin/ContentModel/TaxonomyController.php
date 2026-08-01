<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\ContentModel;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ContentModel\TaxonomyRequest;
use App\Models\DynamicContentTerm;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\TaxonomyManager;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Admin CRUD for taxonomies. Wraps `TaxonomyManager` (see
 * {@see ContentTypeController} for the wrap-managers-not-JSON-API
 * decision).
 *
 * Each taxonomy row binds to a single content type via the framework's
 * scalar `content_type_slug` column. To attach a taxonomy to multiple
 * content types today, admins create one taxonomy per binding — a pivot
 * / JSON multi-binding is a framework-side follow-up.
 */
class TaxonomyController extends Controller
{
    public function __construct(
        private readonly TaxonomyManager $manager,
        private readonly ContentTypeManager $contentTypeManager,
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/content-model/Taxonomies', [
            'taxonomies'   => $this->taxonomiesPayload(),
            'contentTypes' => $this->contentTypeOptions(),
        ]);
    }

    public function store(TaxonomyRequest $request): RedirectResponse
    {
        try {
            $taxonomy = $this->manager->createTaxonomy($request->validated());
        } catch (Throwable $e) {
            report($e);

            return back()
                ->withInput()
                ->withErrors(['slug' => __('Failed to create taxonomy.')]);
        }

        doAction('keystone.admin.contentTypes.taxonomy.created', $taxonomy);

        return redirect()
            ->route('admin.content-model.taxonomies.index')
            ->with('success', __('Taxonomy ":name" created.', ['name' => $taxonomy->name]));
    }

    public function edit(string $taxonomy): Response
    {
        $model = $this->manager->getPersistedTaxonomy($taxonomy);

        abort_if(null === $model, 404);

        return Inertia::render('admin/content-model/TaxonomyEdit', [
            'taxonomy'     => $this->rowPayload($model->toArray(), true),
            'contentTypes' => $this->contentTypeOptions(),
        ]);
    }

    public function update(TaxonomyRequest $request, string $taxonomy): RedirectResponse
    {
        $model = $this->manager->getPersistedTaxonomy($taxonomy);

        if (null === $model) {
            return back()->withErrors(['slug' => __('Taxonomy ":slug" is not editable.', ['slug' => $taxonomy])]);
        }

        $data = $request->validated();
        // Slug stays fixed after creation — renaming a taxonomy slug in
        // place breaks references stored on content rows.
        unset($data['slug']);

        try {
            $updated = $this->manager->updateTaxonomy($taxonomy, $data);
        } catch (Throwable $e) {
            report($e);

            return back()
                ->withInput()
                ->withErrors(['slug' => __('Failed to update taxonomy.')]);
        }

        doAction('keystone.admin.contentTypes.taxonomy.updated', $updated);

        return redirect()
            ->route('admin.content-model.taxonomies.index')
            ->with('success', __('Taxonomy ":name" updated.', ['name' => $updated->name]));
    }

    /**
     * Inline term creation endpoint the DynamicContentEdit sidebar posts
     * to when an editor types a new term into a taxonomy chip picker.
     * Returns the persisted term so the picker can append it to its
     * option list without a full page reload.
     */
    public function storeTerm(Request $request, string $taxonomy): JsonResponse
    {
        $model = $this->manager->getPersistedTaxonomy($taxonomy);
        abort_if(null === $model, 404);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        // The `(taxonomy_slug, slug)` unique index on
        // `keystone_dynamic_content_terms` closes the SELECT+INSERT race
        // uniqueTermSlug otherwise has: two admins hitting "Add" at the
        // same instant would each read no existing collision, then both
        // try to insert `region-2`. Retry a bounded number of times
        // after a unique-constraint bounce; give up cleanly rather than
        // spin forever.
        $baseName = (string) $data['name'];
        $term     = null;
        for ($attempt = 0; $attempt < 5 && null === $term; $attempt++) {
            $slug = $this->uniqueTermSlug($taxonomy, $baseName);
            try {
                $term = DynamicContentTerm::create([
                    'taxonomy_slug' => $taxonomy,
                    'name'          => $baseName,
                    'slug'          => $slug,
                ]);
            } catch (UniqueConstraintViolationException) {
                // Race: someone else inserted this slug between our
                // uniqueness check and our insert. Loop to re-derive.
            }
        }

        abort_if(null === $term, 409, 'Could not allocate a unique term slug.');

        doAction('keystone.admin.contentTypes.term.created', $term);

        return response()->json(['id' => (int) $term->id, 'name' => $term->name]);
    }

    public function destroy(string $taxonomy): RedirectResponse
    {
        $model = $this->manager->getPersistedTaxonomy($taxonomy);

        if (null === $model) {
            return back()->withErrors(['slug' => __('Taxonomy ":slug" cannot be removed.', ['slug' => $taxonomy])]);
        }

        // Snapshot the terms about to be cascade-deleted so subscribers
        // still get the full term payload after the transaction commits.
        // Fetching inside the transaction and firing pre-cascade would
        // let a subscriber exception roll the whole delete back — and a
        // rollback would leave prior subscribers with phantom
        // "term.deleted" events for terms that still exist.
        $terms = DynamicContentTerm::query()->where('taxonomy_slug', $taxonomy)->get();

        try {
            DB::transaction(function () use ($taxonomy): void {
                // Cascade every term owned by this taxonomy (and their
                // pivot assignments via the FK on the pivot table);
                // otherwise recreating the taxonomy with the same slug
                // would inherit the old terms in a confusing zombie
                // state.
                DynamicContentTerm::query()
                    ->where('taxonomy_slug', $taxonomy)
                    ->delete();

                $this->manager->deleteTaxonomy($taxonomy);
            });
        } catch (Throwable $e) {
            report($e);

            return back()->withErrors(['slug' => __('Failed to delete taxonomy.')]);
        }

        // Post-commit fires: taxonomy first, then one `.term.deleted`
        // per cascaded term.
        doAction('keystone.admin.contentTypes.taxonomy.deleted', $model);
        foreach ($terms as $term) {
            doAction('keystone.admin.contentTypes.term.deleted', $term);
        }

        return redirect()
            ->route('admin.content-model.taxonomies.index')
            ->with('success', __('Taxonomy ":name" removed.', ['name' => $model->name]));
    }

    private function uniqueTermSlug(string $taxonomy, string $name): string
    {
        $base    = Str::slug($name) ?: 'term';
        $slug    = $base;
        $counter = 2;
        while (DynamicContentTerm::query()->where('taxonomy_slug', $taxonomy)->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function taxonomiesPayload(): array
    {
        $rows = [];

        foreach ($this->manager->getRegisteredTaxonomies() as $slug => $entry) {
            if (! is_array($entry)) {
                continue;
            }

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
            'id'                => $entry['id'] ?? null,
            'slug'              => (string) ($entry['slug'] ?? ''),
            'name'              => (string) ($entry['name'] ?? $entry['slug'] ?? ''),
            'content_type_slug' => (string) ($entry['content_type_slug'] ?? ''),
            'description'       => (string) ($entry['description'] ?? ''),
            'hierarchical'      => (bool) ($entry['hierarchical'] ?? false),
            'show_in_admin'     => (bool) ($entry['show_in_admin'] ?? true),
            'rest_base'         => (string) ($entry['rest_base'] ?? ''),
            'is_editable'       => $isEditable,
        ];
    }

    /**
     * @return list<array{slug: string, name: string}>
     */
    private function contentTypeOptions(): array
    {
        $out = [];

        foreach ($this->contentTypeManager->getRegisteredContentTypes() as $slug => $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $entry['slug'] = (string) ($entry['slug'] ?? $slug);
            $out[]         = [
                'slug' => $entry['slug'],
                'name' => (string) ($entry['name'] ?? $entry['slug']),
            ];
        }

        return $out;
    }
}
