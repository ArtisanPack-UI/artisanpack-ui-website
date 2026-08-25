<?php

declare(strict_types=1);

namespace Modules\Pages\Http\Controllers;

use App\Http\Controllers\Admin\Concerns\HandlesPublication;
use App\Http\Controllers\Controller;
use App\Support\ContentEdit\CustomFieldSupport;
use App\Support\ContentEdit\PanelSlotSupport;
use App\Support\ContentEdit\SlugPreview;
use App\Support\PreviewUrl;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Pages\Managers\PageManager;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Resolution\ResolvedEntity;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Resolution\TemplateResolver;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Media\Support\ImageMediaRule;
use Modules\Seo\Support\SeoMetaSupport;
use Modules\Users\Models\UserEditorPreference;

/**
 * Admin-side Pages CRUD.
 *
 * Backs `/admin/pages` against the cms-framework Pages module. The visual
 * editor is deferred (orchestrator Wave 8) — the edit screen renders
 * `<EditorPlaceholder />` for now and only exposes the post-meta fields
 * (title, slug, status). Limits are enforced via `keystone.limits.max_pages`.
 */
class PageController extends Controller
{
    use HandlesPublication;

    public function __construct(
        private readonly PageManager $pages,
        private readonly TemplateResolver $templates,
    ) {}

    public function index(): Response
    {
        $pages = Page::query()
            ->with('author:id,display_name')
            ->latest('updated_at')
            ->get(['id', 'title', 'slug', 'status', 'author_id', 'updated_at']);

        return Inertia::render('admin/pages/Index', [
            'pages' => $pages->map(fn (Page $page) => $this->rowPayload($page))->all(),
            'limit' => [
                'max'     => config('keystone.limits.max_pages'),
                'current' => $pages->count(),
            ],
            'newContent' => [
                'label'          => 'page',
                'hierarchical'   => true,
                // Reuse the already-loaded index collection instead of
                // firing a second unbounded pages query for the modal's
                // parent picker — same rows, just reshaped + resorted.
                'parentOptions'  => $pages
                    ->sortBy(fn (Page $p) => strtolower((string) $p->title))
                    ->values()
                    ->map(fn (Page $p) => [
                        'value' => (int) $p->id,
                        'label' => (string) $p->title,
                    ])
                    ->all(),
                'templates'      => $this->templateOptions(),
                'quickCreateUrl' => route('admin.pages.quick-create'),
            ],
        ]);
    }

    /**
     * Quick-create endpoint for the Add New modal (#184). Accepts a
     * user-supplied title (+ optional parent and template) and creates
     * a real draft via {@see PageManager::create()} — replaces the old
     * auto-draft "Untitled page" stub. Same `max_pages` gate as store().
     */
    public function quickCreate(Request $request): RedirectResponse
    {
        if ($this->limitReached()) {
            return redirect()
                ->route('admin.pages.index')
                ->with('error', $this->limitMessage());
        }

        $validated = $request->validate([
            'title'     => ['required', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', Rule::exists('pages', 'id')],
            'template'  => ['nullable', 'string', 'max:255'],
        ]);

        $page = $this->pages->create([
            'title'     => $validated['title'],
            'status'    => ContentStatus::Draft->value,
            'parent_id' => $validated['parent_id'] ?? null,
            'template'  => $validated['template'] ?? null,
        ], null, $request->user()?->id);

        return redirect()->route('admin.pages.edit', $page);
    }

    public function store(Request $request): RedirectResponse
    {
        if ($this->limitReached()) {
            return redirect()
                ->route('admin.pages.index')
                ->with('error', $this->limitMessage());
        }

        // See `PostController::store()` — same rationale for the
        // template instance and the ordering: filter runs on validated
        // payload, custom fields assigned in-memory before the initial
        // insert.
        $template = new Page;

        $validated = $request->validate(array_merge([
            'title'             => ['required', 'string', 'max:255'],
            'slug'              => ['nullable', 'string', 'max:255', 'alpha_dash', 'unique:pages,slug'],
            'status'            => ['required', Rule::enum(ContentStatus::class)],
            'excerpt'           => ['nullable', 'string', 'max:1000'],
            'template'          => ['nullable', 'string', 'max:255'],
            'parent_id'         => ['nullable', 'integer', Rule::exists('pages', 'id')],
            'order'             => ['nullable', 'integer', 'min:0'],
            'featured_image_id' => ImageMediaRule::nullable(),
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($template)));

        $validated = PanelSlotSupport::filterSave('pages', $validated);

        $page = $this->pages->create([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'] ?? '',
            'status'            => $validated['status'],
            'excerpt'           => $validated['excerpt'] ?? null,
            'template'          => $validated['template'] ?? null,
            'parent_id'         => $validated['parent_id'] ?? null,
            'order'             => $validated['order'] ?? 0,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
        ], null, $request->user()?->id);

        if (! empty($validated['custom_fields'])) {
            CustomFieldSupport::apply($page, $validated['custom_fields']);
            $page->save();
        }

        SeoMetaSupport::save($page, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.pages.edit', $page)
            ->with('success', 'Page created.');
    }

    public function edit(Request $request, Page $page): Response
    {
        $page->loadMissing('author:id,display_name', 'featuredImageMedia');

        return Inertia::render('admin/pages/Edit', [
            'page' => [
                'id'                      => $page->id,
                'title'                   => $page->title,
                'slug'                    => $page->slug,
                'permalink_template'      => url('/').'/{slug}',
                'status'                  => $page->status->value,
                'actual_status'           => $this->actualStatus($page),
                'has_ever_been_published' => null !== $page->published_at,
                'excerpt'                 => $page->excerpt,
                'template'                => $page->template,
                'parent_id'               => $page->parent_id,
                'order'                   => $page->order,
                'author'                  => $page->author?->display_name,
                'published_at'            => optional($page->published_at)->toISOString(),
                'updated_at'              => optional($page->updated_at)->toISOString(),
                'featured_image'          => $this->featuredImagePayload($page),
                'seo'                     => SeoMetaSupport::payload($page),
                'preview_url'             => PreviewUrl::for($page),
            ],
            'statuses'      => $this->statusOptions(),
            'siteTimezone'  => (string) config('app.timezone'),
            'parentOptions' => $this->parentOptions($page),
            'customFields'  => CustomFieldSupport::payload($page),
            'contentEdit'   => PanelSlotSupport::payload('pages', $page),
            'supports'      => $page->supports(),
            // #189 — Screen Options hydration. Per-user and per-post-type,
            // so it is deliberately not part of the `page` payload.
            'editorPreferences' => UserEditorPreference::payloadFor($request->user(), 'pages'),
        ]);
    }

    public function update(Request $request, Page $page): RedirectResponse
    {
        $validated = $request->validate(array_merge([
            'title'             => ['required', 'string', 'max:255'],
            'slug'              => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('pages', 'slug')->ignore($page->id)],
            'status'            => ['required', Rule::enum(ContentStatus::class)],
            'published_at'      => $this->publishedAtRules($request, $page),
            'excerpt'           => ['nullable', 'string', 'max:1000'],
            'template'          => ['nullable', 'string', 'max:255'],
            'parent_id'         => [
                'nullable',
                'integer',
                Rule::exists('pages', 'id')->whereNot('id', $page->id),
                $this->parentIsNotDescendant($page),
            ],
            'order'             => ['nullable', 'integer', 'min:0'],
            'featured_image_id' => ImageMediaRule::nullable(),
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($page)));

        $validated = PanelSlotSupport::filterSave('pages', $validated, $page);

        // Apply custom fields BEFORE the manager fill+save so both
        // hardcoded columns and metadata JSON land in one UPDATE —
        // observers fire exactly once per admin edit.
        CustomFieldSupport::apply($page, $validated['custom_fields'] ?? null);

        $this->pages->update($page, array_merge([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'],
            'excerpt'           => $validated['excerpt'] ?? null,
            'template'          => $validated['template'] ?? null,
            'parent_id'         => $validated['parent_id'] ?? null,
            'order'             => $validated['order'] ?? 0,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
        ], $this->resolvePublication($validated, $page)));

        SeoMetaSupport::save($page, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.pages.edit', $page)
            ->with('success', 'Page updated.');
    }

    public function destroy(Page $page): RedirectResponse
    {
        $this->pages->delete($page);

        return redirect()
            ->route('admin.pages.index')
            ->with('success', 'Page deleted.');
    }

    /**
     * Live slug preview for the Page edit screen (#185). Mirror of
     * {@see \Modules\Blog\Http\Controllers\PostController::slugPreview()} —
     * same shape so the frontend
     * component can share code between resources.
     *
     * @return array{slug: string, auto_adjusted: bool}
     */
    public function slugPreview(Request $request): array
    {
        // See PostController::slugPreview() — no `Rule::exists` on
        // `ignore_id` so the per-keystroke preview skips the extra
        // SELECT. Save-time uniqueness still enforced by the
        // `Rule::unique('pages', 'slug')` on `update()`.
        $validated = $request->validate([
            'title'     => ['required', 'string', 'max:255'],
            'ignore_id' => ['nullable', 'integer'],
        ]);

        return SlugPreview::make(
            Page::class,
            $validated['title'],
            'page',
            $validated['ignore_id'] ?? null,
        );
    }

    public function duplicate(Request $request, Page $page): RedirectResponse
    {
        if ($this->limitReached()) {
            return redirect()
                ->route('admin.pages.index')
                ->with('error', $this->limitMessage());
        }

        $copy = $this->pages->duplicate($page, $request->user()?->id);

        return redirect()
            ->route('admin.pages.edit', $copy)
            ->with('success', 'Page duplicated.');
    }

    /**
     * Shape the page's featured image for the admin edit screen. Mirrors the
     * subset of the media-library `Media` resource that the
     * `<FeaturedImagePicker>` UI cares about; emitted null when no image is
     * set.
     *
     * @return array{id: int, url: string, title: string|null, alt_text: string|null, mime_type: string}|null
     */
    private function featuredImagePayload(Page $page): ?array
    {
        $media = $page->featuredImageMedia;

        if (! $media) {
            return null;
        }

        return [
            'id'        => (int) $media->id,
            'url'       => (string) $media->url(),
            'title'     => $media->title,
            'alt_text'  => $media->alt_text,
            'mime_type' => (string) $media->mime_type,
        ];
    }

    /**
     * @return array{id: int, title: string, slug: string, status: string, updated_at: string, author: string, views: int}
     */
    private function rowPayload(Page $page): array
    {
        return [
            'id'         => $page->id,
            'title'      => $page->title,
            'slug'       => $page->slug,
            'status'     => $page->status->value,
            'updated_at' => optional($page->updated_at)->toISOString() ?? '',
            'author'     => $page->author?->display_name ?? '—',
            'views'      => 0,
        ];
    }

    /**
     * Pages that could be the parent of `$current` — every other page in the
     * site, or every page when creating. (Hierarchical descendants are
     * filtered later if/when we add the deep-tree UI; for now the limit is
     * small enough that a flat list is fine.)
     *
     * @return array<int, array{value: int, label: string}>
     */
    private function parentOptions(?Page $current): array
    {
        $query = Page::query()->orderBy('title');

        if (null !== $current) {
            $query->whereKeyNot($current->id);
        }

        return $query
            ->get(['id', 'title'])
            ->map(fn (Page $page) => [
                'value' => $page->id,
                'label' => $page->title,
            ])
            ->all();
    }

    /**
     * Resolved templates for the active theme, shaped for the Add New
     * modal's template picker. Empty when no theme is active or no
     * templates are declared — the modal treats that as "hide the
     * template field."
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function templateOptions(): array
    {
        return array_values(array_map(
            fn (ResolvedEntity $t) => [
                'value' => $t->slug,
                'label' => (string) ($t->title ?? $t->slug),
            ],
            $this->templates->all(),
        ));
    }

    /**
     * Private is offered here (#233) because the status is reachable
     * without this dropdown — the visual editor, an import, or a plugin
     * can persist it — and omitting it meant the admin could see a
     * private page but never change it back. `PublicVisibility::pages()`
     * already keeps those pages off the public site.
     *
     * @return array<int, array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return [
            ['value' => ContentStatus::Draft->value, 'label' => 'Draft'],
            ['value' => ContentStatus::Published->value, 'label' => 'Published'],
            ['value' => ContentStatus::Scheduled->value, 'label' => 'Scheduled'],
            ['value' => ContentStatus::Private->value, 'label' => 'Private'],
        ];
    }

    /**
     * Closure rule rejecting a parent that lives underneath the page being
     * edited.
     *
     * `Rule::exists(...)->whereNot('id', $page->id)` only blocks a page
     * from parenting itself, so A→B followed by B→A produced a cycle: the
     * two pages become unreachable from the tree root, and anything that
     * walks ancestors (breadcrumbs, nested permalinks, the parent picker)
     * loops forever on them.
     *
     * The walk is bounded independently of the cycle check — an existing
     * cycle in the data would otherwise make the guard itself hang.
     */
    private function parentIsNotDescendant(Page $page): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($page): void {
            if (null === $value || '' === $value) {
                return;
            }

            $ancestorId = (int) $value;
            $seen       = [];

            for ($hops = 0; $hops < 100 && $ancestorId > 0; $hops++) {
                if ($ancestorId === $page->id) {
                    $fail(__('That page is already below this one, which would create a loop.'));

                    return;
                }

                if (isset($seen[$ancestorId])) {
                    return;
                }

                $seen[$ancestorId] = true;

                /** @var mixed $next */
                $next = Page::query()->whereKey($ancestorId)->value('parent_id');

                $ancestorId = is_numeric($next) ? (int) $next : 0;
            }
        };
    }

    private function limitReached(): bool
    {
        $max = config('keystone.limits.max_pages');

        return is_int($max) && Page::query()->count() >= $max;
    }

    private function limitMessage(): string
    {
        $max = (int) config('keystone.limits.max_pages');

        return "You've reached the {$max}-page limit for this plan. Delete an existing page or upgrade to add more.";
    }

    /**
     * Server-derived read-only status for the Publish box's status
     * pill (#187). Mirrors PostController::actualStatus() — a
     * Scheduled row whose `published_at` is in the past is treated
     * as effectively Published even if the DB column hasn't been
     * flipped yet.
     */
    private function actualStatus(Page $page): string
    {
        if (ContentStatus::Scheduled === $page->status
            && null !== $page->published_at
            && $page->published_at->isPast()) {
            return ContentStatus::Published->value;
        }

        return $page->status->value;
    }
}
