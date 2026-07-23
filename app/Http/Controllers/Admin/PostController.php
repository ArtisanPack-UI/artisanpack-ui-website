<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\ContentEdit\CustomFieldSupport;
use App\Support\ContentEdit\PanelSlotSupport;
use App\Support\PermalinkStructure;
use App\Support\Seo\SeoMetaSupport;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\PostCategory;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\PostTag;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-side Posts CRUD.
 *
 * Backs `/admin/posts` against the cms-framework Blog module. The visual
 * editor placeholder is the same strategy as Pages — the edit screen
 * exposes meta fields and surfaces categories/authors; the block tree
 * lands when the visual-editor wave completes (orchestrator Wave 8).
 *
 * The whole resource is gated by `feature:blog` (`KEYSTONE_BLOG_ENABLED`)
 * at the route layer.
 */
class PostController extends Controller
{
    public function __construct(private readonly PermalinkStructure $permalinks) {}

    public function index(): Response
    {
        $posts = Post::query()
            ->with(['author:id,display_name', 'categories:id,name,slug'])
            ->latest('updated_at')
            ->get(['id', 'title', 'slug', 'status', 'author_id', 'published_at', 'updated_at']);

        return Inertia::render('admin/posts/Index', [
            'posts'      => $posts->map(fn (Post $post) => $this->rowPayload($post))->all(),
            'categories' => $this->categoryOptions(),
        ]);
    }

    /**
     * Auto-draft flow — creates an "Untitled post" stub and drops the user
     * straight into the Edit screen so the visual editor mounts immediately.
     */
    public function create(Request $request): RedirectResponse
    {
        $post = Post::create([
            'title'     => 'Untitled post',
            'slug'      => $this->uniqueSlug('untitled-post'),
            'status'    => ContentStatus::Draft,
            'author_id' => $request->user()?->id,
        ]);

        return redirect()->route('admin.posts.edit', $post);
    }

    public function store(Request $request): RedirectResponse
    {
        // `apply()` needs a record to hang custom-field values off, so
        // we validate against the not-yet-persisted Post's custom-field
        // shape first — the field registry is content-type-scoped, not
        // record-scoped, so a template Post instance gives us the right
        // rules without a DB hit.
        $template = new Post;

        $validated = $request->validate(array_merge([
            'title'             => ['required', 'string', 'max:255'],
            'slug'              => ['nullable', 'string', 'max:255', 'alpha_dash', 'unique:posts,slug'],
            'status'            => ['required', Rule::enum(ContentStatus::class)],
            'excerpt'           => ['nullable', 'string', 'max:1000'],
            'featured_image_id' => ['nullable', 'integer', Rule::exists('media', 'id')->where(fn ($q) => $q->where('mime_type', 'like', 'image/%'))],
            'category_ids'      => ['array'],
            'category_ids.*'    => ['integer', Rule::exists('post_categories', 'id')],
            'tag_ids'           => ['array'],
            'tag_ids.*'         => ['integer', Rule::exists('post_tags', 'id')],
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($template)));

        $validated = PanelSlotSupport::filterSave('posts', $validated);

        $status = ContentStatus::from($validated['status']);

        $post = new Post([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'] ?: $this->uniqueSlug($validated['title']),
            'status'            => $status,
            'excerpt'           => $validated['excerpt'] ?? null,
            'author_id'         => $request->user()?->id,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
            'published_at'      => ContentStatus::Published === $status ? now() : null,
        ]);

        // Assign custom-field values via the trait's magic setter before
        // the initial insert so a single INSERT captures both the
        // hardcoded columns and the metadata JSON.
        CustomFieldSupport::apply($post, $validated['custom_fields'] ?? null);

        $post->save();

        if (! empty($validated['category_ids'])) {
            $post->categories()->sync($validated['category_ids']);
        }

        if (! empty($validated['tag_ids'])) {
            $post->tags()->sync($validated['tag_ids']);
        }

        SeoMetaSupport::save($post, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.posts.edit', $post)
            ->with('success', 'Post created.');
    }

    public function edit(Post $post): Response
    {
        $post->loadMissing(['author:id,display_name', 'categories:id,name,slug', 'tags:id,name', 'featuredImageMedia']);

        return Inertia::render('admin/posts/Edit', [
            'post' => [
                'id'             => $post->id,
                'title'          => $post->title,
                'slug'           => $post->slug,
                'permalink'      => $this->permalinks->path($post),
                'status'         => $post->status->value,
                'excerpt'        => $post->excerpt,
                'author'         => $post->author?->display_name,
                'category_ids'   => $post->categories->pluck('id')->all(),
                'tag_ids'        => $post->tags->pluck('id')->all(),
                'published_at'   => optional($post->published_at)->toISOString(),
                'updated_at'     => optional($post->updated_at)->toISOString(),
                'featured_image' => $this->featuredImagePayload($post),
                'seo'            => SeoMetaSupport::payload($post),
            ],
            'statuses'     => $this->statusOptions(),
            'categories'   => $this->categoryOptions(),
            'tags'         => $this->tagOptions(),
            'customFields' => CustomFieldSupport::payload($post),
            'contentEdit'  => PanelSlotSupport::payload('posts', $post),
        ]);
    }

    public function update(Request $request, Post $post): RedirectResponse
    {
        $validated = $request->validate(array_merge([
            'title'             => ['required', 'string', 'max:255'],
            'slug'              => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('posts', 'slug')->ignore($post->id)],
            'status'            => ['required', Rule::enum(ContentStatus::class)],
            'excerpt'           => ['nullable', 'string', 'max:1000'],
            'featured_image_id' => ['nullable', 'integer', Rule::exists('media', 'id')->where(fn ($q) => $q->where('mime_type', 'like', 'image/%'))],
            'category_ids'      => ['array'],
            'category_ids.*'    => ['integer', Rule::exists('post_categories', 'id')],
            'tag_ids'           => ['array'],
            'tag_ids.*'         => ['integer', Rule::exists('post_tags', 'id')],
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($post)));

        // Run the panel save filter on the VALIDATED payload so a
        // plugin can't silently drop `title`/`slug` and surface it as
        // a confusing required-field error against text the admin
        // actually submitted. Plugins can still annotate `custom_fields`
        // and other keys after validation.
        $validated = PanelSlotSupport::filterSave('posts', $validated, $post);

        $status       = ContentStatus::from($validated['status']);
        $wasPublished = ContentStatus::Published === $post->status;
        $nowPublished = ContentStatus::Published === $status;

        $post->fill([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'],
            'status'            => $status,
            'excerpt'           => $validated['excerpt'] ?? null,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
        ]);

        if ($nowPublished && ! $wasPublished) {
            $post->published_at = now();
        }

        // Assign before save so the single UPDATE writes both the
        // hardcoded columns and any metadata JSON changes; observers
        // fire exactly once per admin edit.
        CustomFieldSupport::apply($post, $validated['custom_fields'] ?? null);

        $post->save();

        $post->categories()->sync($validated['category_ids'] ?? []);
        $post->tags()->sync($validated['tag_ids'] ?? []);

        SeoMetaSupport::save($post, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.posts.edit', $post)
            ->with('success', 'Post updated.');
    }

    public function destroy(Post $post): RedirectResponse
    {
        $post->delete();

        return redirect()
            ->route('admin.posts.index')
            ->with('success', 'Post deleted.');
    }

    public function duplicate(Request $request, Post $post): RedirectResponse
    {
        $copy            = $post->replicate(['published_at']);
        $copy->title     = $post->title.' (Copy)';
        $copy->slug      = $this->uniqueSlug($post->slug.'-copy');
        $copy->status    = ContentStatus::Draft;
        $copy->author_id = $request->user()?->id ?? $post->author_id;
        $copy->save();

        $copy->categories()->sync($post->categories->pluck('id')->all());
        $copy->tags()->sync($post->tags->pluck('id')->all());

        return redirect()
            ->route('admin.posts.edit', $copy)
            ->with('success', 'Post duplicated.');
    }

    /**
     * Shape the post's featured image for the admin edit screen. Mirrors
     * the subset of the media-library `Media` resource that the
     * `<FeaturedImagePicker>` UI cares about; emitted null when no image is
     * set.
     *
     * @return array{id: int, url: string, title: string|null, alt_text: string|null, mime_type: string}|null
     */
    private function featuredImagePayload(Post $post): ?array
    {
        $media = $post->featuredImageMedia;

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
     * @return array{id: int, title: string, slug: string, permalink: string, status: string, category: string, published_at: string|null, author: string, comments: int}
     */
    private function rowPayload(Post $post): array
    {
        return [
            'id'           => $post->id,
            'title'        => $post->title,
            'slug'         => $post->slug,
            'permalink'    => $this->permalinks->path($post),
            'status'       => $post->status->value,
            'category'     => $post->categories->first()?->name ?? '—',
            'published_at' => optional($post->published_at)->toISOString(),
            'author'       => $post->author?->display_name ?? '—',
            'comments'     => 0,
        ];
    }

    /**
     * @return array<int, array{value: int, label: string}>
     */
    private function categoryOptions(): array
    {
        return PostCategory::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (PostCategory $cat) => [
                'value' => $cat->id,
                'label' => $cat->name,
            ])
            ->all();
    }

    /**
     * @return array<int, array{value: int, label: string}>
     */
    private function tagOptions(): array
    {
        return PostTag::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (PostTag $tag) => [
                'value' => $tag->id,
                'label' => $tag->name,
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

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'post';
        $slug = $base;
        $i    = 2;

        while (Post::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
