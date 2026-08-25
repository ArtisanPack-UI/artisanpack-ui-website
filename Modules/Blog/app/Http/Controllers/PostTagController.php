<?php

declare(strict_types=1);

namespace Modules\Blog\Http\Controllers;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\PostTag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-side Post Tags CRUD.
 *
 * Surfaces the cms-framework `post_tags` table behind `/admin/posts/tags`.
 * Flat list (no parent/child). Gated by `feature:blog` at the route layer.
 */
class PostTagController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/posts/tags/Index', [
            'tags' => $this->listPayload(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->rules());

        PostTag::create([
            'name'        => $validated['name'],
            'slug'        => ! empty($validated['slug'])
                ? $validated['slug']
                : $this->uniqueSlug($validated['name']),
            'description' => $validated['description'] ?? null,
            'order'       => $validated['order'] ?? 0,
        ]);

        // `back()` so quick-create from the post Edit screen lands back on
        // that screen with refreshed props — see PostCategoryController.
        return back()->with('success', 'Tag created.');
    }

    public function edit(PostTag $tag): Response
    {
        return Inertia::render('admin/posts/tags/Edit', [
            'tag' => [
                'id'          => $tag->id,
                'name'        => $tag->name,
                'slug'        => $tag->slug,
                'description' => $tag->description,
                'order'       => $tag->order,
            ],
        ]);
    }

    public function update(Request $request, PostTag $tag): RedirectResponse
    {
        $validated = $request->validate($this->rules($tag->id));

        $tag->update([
            'name'        => $validated['name'],
            'slug'        => $validated['slug'],
            'description' => $validated['description'] ?? null,
            'order'       => $validated['order'] ?? 0,
        ]);

        return redirect()
            ->route('admin.posts.tags.index')
            ->with('success', 'Tag updated.');
    }

    public function destroy(PostTag $tag): RedirectResponse
    {
        $tag->delete();

        return redirect()
            ->route('admin.posts.tags.index')
            ->with('success', 'Tag deleted.');
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private function rules(?int $ignoreId = null): array
    {
        $slugRule = Rule::unique('post_tags', 'slug');
        if (null !== $ignoreId) {
            $slugRule = $slugRule->ignore($ignoreId);
        }

        $required = null === $ignoreId ? 'nullable' : 'required';

        return [
            'name'        => ['required', 'string', 'max:255'],
            'slug'        => [$required, 'string', 'max:255', 'alpha_dash', $slugRule],
            'description' => ['nullable', 'string', 'max:1000'],
            'order'       => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<int, array{id: int, name: string, slug: string, description: string|null, posts_count: int, updated_at: string}>
     */
    private function listPayload(): array
    {
        return PostTag::query()
            ->withCount('posts')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'order', 'updated_at'])
            ->map(fn (PostTag $tag) => [
                'id'          => $tag->id,
                'name'        => $tag->name,
                'slug'        => $tag->slug,
                'description' => $tag->description,
                'posts_count' => (int) ($tag->posts_count ?? 0),
                'updated_at'  => optional($tag->updated_at)->toISOString() ?? '',
            ])
            ->all();
    }

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'tag';
        $slug = $base;
        $i    = 2;

        while (PostTag::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
