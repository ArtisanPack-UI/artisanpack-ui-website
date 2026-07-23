<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\ContentEdit\CustomFieldSupport;
use App\Support\ContentEdit\PanelSlotSupport;
use App\Support\Seo\SeoMetaSupport;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

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
        ]);
    }

    /**
     * Auto-draft flow — creates an "Untitled page" stub (subject to the
     * `max_pages` limit) and drops the user straight into the Edit screen
     * so the visual editor mounts immediately.
     */
    public function create(Request $request): RedirectResponse
    {
        if ($this->limitReached()) {
            return redirect()
                ->route('admin.pages.index')
                ->with('error', $this->limitMessage());
        }

        $page = Page::create([
            'title'     => 'Untitled page',
            'slug'      => $this->uniqueSlug('untitled-page'),
            'status'    => ContentStatus::Draft,
            'author_id' => $request->user()?->id,
            'order'     => 0,
        ]);

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
            'featured_image_id' => ['nullable', 'integer', Rule::exists('media', 'id')->where(fn ($q) => $q->where('mime_type', 'like', 'image/%'))],
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($template)));

        $validated = PanelSlotSupport::filterSave('pages', $validated);

        $status = ContentStatus::from($validated['status']);

        $page = new Page([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'] ?: $this->uniqueSlug($validated['title']),
            'status'            => $status,
            'excerpt'           => $validated['excerpt'] ?? null,
            'template'          => $validated['template'] ?? null,
            'parent_id'         => $validated['parent_id'] ?? null,
            'author_id'         => $request->user()?->id,
            'order'             => $validated['order'] ?? 0,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
            'published_at'      => ContentStatus::Published === $status ? now() : null,
        ]);

        CustomFieldSupport::apply($page, $validated['custom_fields'] ?? null);

        $page->save();

        SeoMetaSupport::save($page, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.pages.edit', $page)
            ->with('success', 'Page created.');
    }

    public function edit(Page $page): Response
    {
        $page->loadMissing('author:id,display_name', 'featuredImageMedia');

        return Inertia::render('admin/pages/Edit', [
            'page' => [
                'id'             => $page->id,
                'title'          => $page->title,
                'slug'           => $page->slug,
                'status'         => $page->status->value,
                'excerpt'        => $page->excerpt,
                'template'       => $page->template,
                'parent_id'      => $page->parent_id,
                'order'          => $page->order,
                'author'         => $page->author?->display_name,
                'updated_at'     => optional($page->updated_at)->toISOString(),
                'featured_image' => $this->featuredImagePayload($page),
                'seo'            => SeoMetaSupport::payload($page),
            ],
            'statuses'      => $this->statusOptions(),
            'parentOptions' => $this->parentOptions($page),
            'customFields'  => CustomFieldSupport::payload($page),
            'contentEdit'   => PanelSlotSupport::payload('pages', $page),
        ]);
    }

    public function update(Request $request, Page $page): RedirectResponse
    {
        $validated = $request->validate(array_merge([
            'title'             => ['required', 'string', 'max:255'],
            'slug'              => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('pages', 'slug')->ignore($page->id)],
            'status'            => ['required', Rule::enum(ContentStatus::class)],
            'excerpt'           => ['nullable', 'string', 'max:1000'],
            'template'          => ['nullable', 'string', 'max:255'],
            'parent_id'         => ['nullable', 'integer', Rule::exists('pages', 'id')->whereNot('id', $page->id)],
            'order'             => ['nullable', 'integer', 'min:0'],
            'featured_image_id' => ['nullable', 'integer', Rule::exists('media', 'id')->where(fn ($q) => $q->where('mime_type', 'like', 'image/%'))],
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($page)));

        $validated = PanelSlotSupport::filterSave('pages', $validated, $page);

        $status       = ContentStatus::from($validated['status']);
        $wasPublished = ContentStatus::Published === $page->status;
        $nowPublished = ContentStatus::Published === $status;

        $page->fill([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'],
            'status'            => $status,
            'excerpt'           => $validated['excerpt'] ?? null,
            'template'          => $validated['template'] ?? null,
            'parent_id'         => $validated['parent_id'] ?? null,
            'order'             => $validated['order'] ?? 0,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
        ]);

        if ($nowPublished && ! $wasPublished) {
            $page->published_at = now();
        }

        CustomFieldSupport::apply($page, $validated['custom_fields'] ?? null);

        $page->save();

        SeoMetaSupport::save($page, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.pages.edit', $page)
            ->with('success', 'Page updated.');
    }

    public function destroy(Page $page): RedirectResponse
    {
        $page->delete();

        return redirect()
            ->route('admin.pages.index')
            ->with('success', 'Page deleted.');
    }

    public function duplicate(Request $request, Page $page): RedirectResponse
    {
        if ($this->limitReached()) {
            return redirect()
                ->route('admin.pages.index')
                ->with('error', $this->limitMessage());
        }

        $copy            = $page->replicate(['published_at']);
        $copy->title     = $page->title.' (Copy)';
        $copy->slug      = $this->uniqueSlug($page->slug.'-copy');
        $copy->status    = ContentStatus::Draft;
        $copy->author_id = $request->user()?->id ?? $page->author_id;
        $copy->save();

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
     * @return array<int, array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return [
            ['value' => ContentStatus::Draft->value, 'label' => 'Draft'],
            ['value' => ContentStatus::Published->value, 'label' => 'Published'],
            ['value' => ContentStatus::Scheduled->value, 'label' => 'Scheduled'],
        ];
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

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'page';
        $slug = $base;
        $i    = 2;

        while (Page::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
