<?php

declare(strict_types=1);

namespace Modules\Blog\Http\Controllers;

use App\Http\Controllers\Admin\Concerns\HandlesPublication;
use App\Http\Controllers\Controller;
use App\Support\ContentEdit\CustomFieldSupport;
use App\Support\ContentEdit\PanelSlotSupport;
use App\Support\ContentEdit\SlugPreview;
use App\Support\PermalinkStructure;
use App\Support\PreviewUrl;
use ArtisanPackUI\CMSFramework\Modules\Blog\Managers\BlogManager;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\PostCategory;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\PostTag;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Media\Support\ImageMediaRule;
use Modules\Seo\Support\SeoMetaSupport;
use Modules\Users\Models\UserEditorPreference;

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
    use HandlesPublication;

    public function __construct(
        private readonly PermalinkStructure $permalinks,
        private readonly BlogManager $blog,
    ) {}

    public function index(): Response
    {
        $posts = Post::query()
            ->with(['author:id,display_name', 'categories:id,name,slug'])
            ->latest('updated_at')
            ->get(['id', 'title', 'slug', 'status', 'author_id', 'published_at', 'updated_at']);

        return Inertia::render('admin/posts/Index', [
            'posts'      => $posts->map(fn (Post $post) => $this->rowPayload($post))->all(),
            'categories' => $this->categoryOptions(),
            'newContent' => [
                'label'          => 'post',
                'hierarchical'   => false,
                'parentOptions'  => [],
                'templates'      => [],
                'quickCreateUrl' => route('admin.posts.quick-create'),
            ],
        ]);
    }

    /**
     * Quick-create endpoint for the Add New modal (#184). Accepts a
     * user-supplied title and creates a real draft via
     * {@see BlogManager::create()} — no more "Untitled post" auto-draft
     * row on GET /create. Redirects straight into Edit so the visual
     * editor mounts against real content from frame one.
     */
    public function quickCreate(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $post = $this->blog->create([
            'title'  => $validated['title'],
            'status' => ContentStatus::Draft->value,
        ], null, $request->user()?->id);

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
            'featured_image_id' => ImageMediaRule::nullable(),
            'category_ids'      => ['array'],
            'category_ids.*'    => ['integer', Rule::exists('post_categories', 'id')],
            'tag_ids'           => ['array'],
            'tag_ids.*'         => ['integer', Rule::exists('post_tags', 'id')],
        ], SeoMetaSupport::rules(), CustomFieldSupport::rules($template)));

        $validated = PanelSlotSupport::filterSave('posts', $validated);

        // Manager owns slug allocation, status coercion, published_at on
        // initial Published, and the transactional write. Custom fields
        // are applied Keystone-side (below) so the shadow-column guard
        // in CustomFieldSupport::apply() stays in the write path — a
        // matching guard in the framework is tracked as a follow-up.
        $post = $this->blog->create([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'] ?? '',
            'status'            => $validated['status'],
            'excerpt'           => $validated['excerpt'] ?? null,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
        ], null, $request->user()?->id);

        if (! empty($validated['custom_fields'])) {
            CustomFieldSupport::apply($post, $validated['custom_fields']);
            $post->save();
        }

        $this->blog->syncCategories($post, $validated['category_ids'] ?? []);
        $this->blog->syncTags($post, $validated['tag_ids'] ?? []);

        SeoMetaSupport::save($post, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.posts.edit', $post)
            ->with('success', 'Post created.');
    }

    public function edit(Request $request, Post $post): Response
    {
        $post->loadMissing(['author:id,display_name', 'categories:id,name,slug', 'tags:id,name', 'featuredImageMedia']);

        return Inertia::render('admin/posts/Edit', [
            'post' => [
                'id'                      => $post->id,
                'title'                   => $post->title,
                'slug'                    => $post->slug,
                'permalink'               => $this->permalinks->path($post),
                'permalink_template'      => $this->permalinkTemplate($post),
                'status'                  => $post->status->value,
                'actual_status'           => $this->actualStatus($post),
                'has_ever_been_published' => null !== $post->published_at,
                'excerpt'                 => $post->excerpt,
                'author'                  => $post->author?->display_name,
                'category_ids'            => $post->categories->pluck('id')->all(),
                'tag_ids'                 => $post->tags->pluck('id')->all(),
                'published_at'            => optional($post->published_at)->toISOString(),
                'updated_at'              => optional($post->updated_at)->toISOString(),
                'featured_image'          => $this->featuredImagePayload($post),
                'seo'                     => SeoMetaSupport::payload($post),
                'preview_url'             => PreviewUrl::for($post),
            ],
            'statuses'     => $this->statusOptions(),
            'siteTimezone' => (string) config('app.timezone'),
            'categories'   => $this->categoryOptions(),
            'tags'         => $this->tagOptions(),
            'customFields' => CustomFieldSupport::payload($post),
            'contentEdit'  => PanelSlotSupport::payload('posts', $post),
            'supports'     => $post->supports(),
            // #189 — Screen Options hydration. Per-user and per-post-type,
            // so it is deliberately not part of the `post` payload.
            'editorPreferences' => UserEditorPreference::payloadFor($request->user(), 'posts'),
        ]);
    }

    public function update(Request $request, Post $post): RedirectResponse
    {
        $validated = $request->validate(array_merge([
            'title'             => ['required', 'string', 'max:255'],
            'slug'              => ['required', 'string', 'max:255', 'alpha_dash', Rule::unique('posts', 'slug')->ignore($post->id)],
            'status'            => ['required', Rule::enum(ContentStatus::class)],
            'published_at'      => $this->publishedAtRules($request, $post),
            'excerpt'           => ['nullable', 'string', 'max:1000'],
            'featured_image_id' => ImageMediaRule::nullable(),
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

        // Apply custom-field values into the in-memory model FIRST so
        // the manager's fill+save below captures both the hardcoded
        // columns and the metadata JSON in a single UPDATE — observers
        // fire exactly once per admin edit. The shadow-column guard in
        // CustomFieldSupport::apply() stays on the write path; a
        // matching guard in the framework is tracked as a follow-up.
        CustomFieldSupport::apply($post, $validated['custom_fields'] ?? null);

        $this->blog->update($post, array_merge([
            'title'             => $validated['title'],
            'slug'              => $validated['slug'],
            'excerpt'           => $validated['excerpt'] ?? null,
            'featured_image_id' => $validated['featured_image_id'] ?? null,
        ], $this->resolvePublication($validated, $post)));

        $this->blog->syncCategories($post, $validated['category_ids'] ?? []);
        $this->blog->syncTags($post, $validated['tag_ids'] ?? []);

        SeoMetaSupport::save($post, $validated['seo'] ?? null);

        return redirect()
            ->route('admin.posts.edit', $post)
            ->with('success', 'Post updated.');
    }

    public function destroy(Post $post): RedirectResponse
    {
        $this->blog->delete($post);

        return redirect()
            ->route('admin.posts.index')
            ->with('success', 'Post deleted.');
    }

    /**
     * Live slug preview for the Post edit screen (#185). The Slug field
     * on drafts derives from the title as the user types; this endpoint
     * hands back the unique slug + an `auto_adjusted` flag so the UI
     * can render `(auto-adjusted)` when the collision counter fires.
     *
     * @return array{slug: string, auto_adjusted: bool}
     */
    public function slugPreview(Request $request): array
    {
        // No `Rule::exists` on `ignore_id` — the preview is a read-only
        // helper the client hits on every keystroke, and skipping the
        // extra "does this post exist" SELECT saves a DB roundtrip per
        // request. A bogus id just becomes a no-op in
        // {@see SlugPreview::exists()} (whereKeyNot against nothing);
        // the real uniqueness gate still fires on save via
        // `Rule::unique('posts', 'slug')`.
        $validated = $request->validate([
            'title'     => ['required', 'string', 'max:255'],
            'ignore_id' => ['nullable', 'integer'],
        ]);

        return SlugPreview::make(
            Post::class,
            $validated['title'],
            'post',
            $validated['ignore_id'] ?? null,
        );
    }

    public function duplicate(Request $request, Post $post): RedirectResponse
    {
        $copy = $this->blog->duplicate($post, $request->user()?->id);

        return redirect()
            ->route('admin.posts.edit', $copy)
            ->with('success', 'Post duplicated.');
    }

    /**
     * Build an absolute permalink template with `{slug}` where the slug
     * segment belongs. The frontend SlugField uses this to render a
     * live URL preview as the user types.
     *
     * We do the substitution by temporarily rebinding the post's slug
     * to a rare sentinel, running the permalink builder, then swapping
     * the sentinel for the `{slug}` placeholder. Cloning the model
     * keeps the caller's instance pristine — the built-in path()
     * caches nothing but any observer that fires on attribute change
     * would be misleading.
     */
    private function permalinkTemplate(Post $post): string
    {
        $sentinel  = '__keystone_slug_placeholder__';
        $clone     = $post->replicate();
        $clone->id = $post->id;
        // `replicate()` drops relationship arrays too, so re-attach the
        // (already-loaded) category collection — `path()` reads the
        // primary category slug for `%category%` structures.
        $clone->setRelation('categories', $post->categories);
        $clone->slug         = $sentinel;
        // `Carbon::now()` rather than the `now()` helper: the helper is
        // declared as returning `CarbonInterface`, which is wider than the
        // `Carbon|null` the property accepts, so static analysis flags the
        // assignment even though the runtime value is fine.
        $clone->published_at = $post->published_at ?? Carbon::now();

        $path = $this->permalinks->path($clone);

        return url(str_replace($sentinel, '{slug}', $path));
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
     * Private is offered here (#233) because the status is reachable
     * without this dropdown — the visual editor, an import, or a plugin
     * can persist it — and omitting it meant the admin could see a
     * private post but never change it back. `PublicVisibility::posts()`
     * already keeps those posts off the public site.
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
     * Server-derived read-only status for the Publish box's status
     * pill (#187). Diverges from `$post->status` in one case: a
     * Scheduled record whose `published_at` is now in the past has
     * effectively gone live even though the DB column may not have
     * been flipped yet by a scheduled-publish worker.
     */
    private function actualStatus(Post $post): string
    {
        if (ContentStatus::Scheduled === $post->status
            && null !== $post->published_at
            && $post->published_at->isPast()) {
            return ContentStatus::Published->value;
        }

        return $post->status->value;
    }
}
