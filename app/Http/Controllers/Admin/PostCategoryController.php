<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\PostCategory;
use Illuminate\Database\QueryException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/**
 * Admin-side Post Categories CRUD.
 *
 * Surfaces the cms-framework `post_categories` table behind
 * `/admin/posts/categories`. Hierarchical (categories can nest via
 * `parent_id`). Gated by `feature:blog` at the route layer.
 */
class PostCategoryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/posts/categories/Index', [
            'categories'    => $this->listPayload(),
            'parentOptions' => $this->parentOptions(null),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate($this->rules());

        $explicitSlug = ! empty($validated['slug']);

        $this->createWithSlugRetry(
            fn (string $slug) => PostCategory::create([
                'name'        => $validated['name'],
                'slug'        => $slug,
                'description' => $validated['description'] ?? null,
                'parent_id'   => $validated['parent_id'] ?? null,
                'order'       => $validated['order'] ?? 0,
            ]),
            $explicitSlug ? $validated['slug'] : $this->uniqueSlug($validated['name']),
            $validated['name'],
            $explicitSlug,
        );

        // `back()` rather than a fixed redirect to the index so quick-create
        // calls from the post Edit screen return the user to that screen
        // with refreshed props — the new category appears in the picker
        // without losing in-progress form state.
        return back()->with('success', 'Category created.');
    }

    public function edit(PostCategory $category): Response
    {
        return Inertia::render('admin/posts/categories/Edit', [
            'category' => [
                'id'          => $category->id,
                'name'        => $category->name,
                'slug'        => $category->slug,
                'description' => $category->description,
                'parent_id'   => $category->parent_id,
                'order'       => $category->order,
            ],
            'parentOptions' => $this->parentOptions($category),
        ]);
    }

    public function update(Request $request, PostCategory $category): RedirectResponse
    {
        $validated = $request->validate($this->rules($category->id, $category));

        $category->update([
            'name'        => $validated['name'],
            'slug'        => $validated['slug'],
            'description' => $validated['description'] ?? null,
            'parent_id'   => $validated['parent_id'] ?? null,
            'order'       => $validated['order'] ?? 0,
        ]);

        return redirect()
            ->route('admin.posts.categories.index')
            ->with('success', 'Category updated.');
    }

    public function destroy(PostCategory $category): RedirectResponse
    {
        $category->delete();

        return redirect()
            ->route('admin.posts.categories.index')
            ->with('success', 'Category deleted.');
    }

    /**
     * @return array<int, array{name: string, rules: array<int, mixed>}>
     */
    private function rules(?int $ignoreId = null, ?PostCategory $current = null): array
    {
        $slugRule = Rule::unique('post_categories', 'slug');
        if (null !== $ignoreId) {
            $slugRule = $slugRule->ignore($ignoreId);
        }

        $required = null === $ignoreId ? 'nullable' : 'required';

        $parentRule = ['nullable', 'integer', Rule::exists('post_categories', 'id')->whereNot('id', $ignoreId)];

        // Reject any descendant of `$current` as a candidate parent. Without
        // this guard, editing a category and choosing one of its own children
        // (or deeper grandchildren) would create a cycle that breaks
        // hierarchy traversal.
        if (null !== $current) {
            $descendantIds = $this->descendantIds($current);
            if ([] !== $descendantIds) {
                $parentRule[] = Rule::notIn($descendantIds);
            }
        }

        return [
            'name'        => ['required', 'string', 'max:255'],
            'slug'        => [$required, 'string', 'max:255', 'alpha_dash', $slugRule],
            'description' => ['nullable', 'string', 'max:1000'],
            'parent_id'   => $parentRule,
            'order'       => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * IDs of every direct + transitive descendant of `$category`. A single
     * query plus an in-memory BFS — the category count is small enough that
     * recursive CTEs aren't worth the SQL-flavor coupling.
     *
     * @return array<int, int>
     */
    private function descendantIds(PostCategory $category): array
    {
        $childrenByParent = PostCategory::query()
            ->select(['id', 'parent_id'])
            ->get()
            ->groupBy('parent_id')
            ->map(fn ($group) => $group->pluck('id')->all());

        $descendants = [];
        $queue       = $childrenByParent[$category->id] ?? [];

        while ([] !== $queue) {
            $id            = array_shift($queue);
            $descendants[] = $id;
            foreach ($childrenByParent[$id] ?? [] as $childId) {
                $queue[] = $childId;
            }
        }

        return $descendants;
    }

    /**
     * @return array<int, array{id: int, name: string, slug: string, parent_id: int|null, posts_count: int, updated_at: string}>
     */
    private function listPayload(): array
    {
        return PostCategory::query()
            ->withCount('posts')
            ->orderBy('order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'parent_id', 'order', 'updated_at'])
            ->map(fn (PostCategory $cat) => [
                'id'          => $cat->id,
                'name'        => $cat->name,
                'slug'        => $cat->slug,
                'description' => $cat->description,
                'parent_id'   => $cat->parent_id,
                'posts_count' => (int) ($cat->posts_count ?? 0),
                'updated_at'  => optional($cat->updated_at)->toISOString() ?? '',
            ])
            ->all();
    }

    /**
     * Categories that could be the parent of `$current` (or any when creating).
     *
     * @return array<int, array{value: int, label: string}>
     */
    private function parentOptions(?PostCategory $current): array
    {
        $query = PostCategory::query()->orderBy('name');

        if (null !== $current) {
            $query->whereKeyNot($current->id);
        }

        return $query
            ->get(['id', 'name'])
            ->map(fn (PostCategory $cat) => [
                'value' => $cat->id,
                'label' => $cat->name,
            ])
            ->all();
    }

    private function uniqueSlug(string $source): string
    {
        $base = Str::slug($source) ?: 'category';
        $slug = $base;
        $i    = 2;

        while (PostCategory::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    /**
     * Insert a category, retrying on slug UNIQUE-constraint violations.
     *
     * `uniqueSlug()` is a `SELECT` followed by an `INSERT` — two concurrent
     * creates can both observe the same slug as available and race to
     * insert. The first wins; the second hits the DB UNIQUE index and
     * throws. Catch that specific failure and retry with a freshly
     * generated slug a few times. Explicit user-supplied slugs are not
     * regenerated — the caller is told the slug is taken via a normal
     * validation failure on retry exhaustion.
     *
     * @param  callable(string $slug): mixed  $insert
     */
    private function createWithSlugRetry(
        callable $insert,
        string $initialSlug,
        string $nameSource,
        bool $slugIsExplicit,
    ): void {
        $slug = $initialSlug;

        for ($attempt = 0; $attempt < 5; $attempt++) {
            try {
                $insert($slug);

                return;
            } catch (QueryException $e) {
                if (! $this->isSlugUniqueViolation($e) || $slugIsExplicit) {
                    throw $e;
                }
                $slug = $this->uniqueSlug($nameSource);
            }
        }

        throw new RuntimeException('Unable to generate a unique slug after 5 attempts.');
    }

    private function isSlugUniqueViolation(QueryException $e): bool
    {
        return '23000' === $e->getCode()
            && str_contains($e->getMessage(), 'slug');
    }
}
