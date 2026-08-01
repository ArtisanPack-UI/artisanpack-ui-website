<?php

declare(strict_types=1);

namespace App\Support\ContentEdit;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * Slug allocation for the live "auto-derive while draft" preview endpoints
 * on Post/Page edit (#185).
 *
 * The manager-side `uniqueSlug()` on BlogManager/PageManager has no
 * "ignore this row" escape hatch — it always treats every row in the
 * table as taken. That's the right shape for CREATE writes but wrong
 * for the preview endpoint on an existing draft: the row's own slug is
 * a valid candidate, and returning `foo-2` when `foo` is free would
 * confuse editors and drift the URL on save.
 *
 * This helper reimplements the same `-2, -3, …` loop but accepts an
 * `ignore_id` so an existing row's slug never fights itself. It also
 * returns whether the base slug was auto-adjusted so the UI can render
 * the `(auto-adjusted)` hint from the spec.
 *
 * @phpstan-type Preview array{slug: string, auto_adjusted: bool}
 */
final class SlugPreview
{
    /**
     * @param  class-string<Model>  $model  Eloquent model whose `slug` column we're checking.
     * @param  string  $source  Text to slugify (usually the title).
     * @param  string  $fallback  Base slug when the source is empty (e.g. `post`).
     * @param  int|null  $ignoreId  Row ID whose current slug should be ignored (edit case).
     * @param  bool  $withTrashed  Include soft-deleted rows in the collision check
     *                             (matches BlogManager/PageManager behaviour so a restore can't
     *                             resurrect a duplicate).
     *
     * @return Preview
     */
    public static function make(
        string $model,
        string $source,
        string $fallback,
        ?int $ignoreId = null,
        bool $withTrashed = true,
    ): array {
        $base = Str::slug($source);

        if ('' === $base) {
            $base = $fallback;
        }

        $slug = self::firstFree($base, self::takenSlugs($model, $base, $ignoreId, $withTrashed));

        return [
            'slug'          => $slug,
            'auto_adjusted' => $slug !== $base,
        ];
    }

    /**
     * Every slug already in use that could block `$base` or one of its
     * numbered variants.
     *
     * One query, not one per collision. The previous shape ran an EXISTS
     * per candidate, so a base slug with a long collision ladder cost a
     * round-trip per rung — on an endpoint the editor hits once per
     * keystroke, and with the rung count fully attacker-controlled by
     * seeding rows.
     *
     * @param  class-string<Model>  $model
     *
     * @return array<string, true> Set of taken slugs, keyed for O(1) lookup.
     */
    private static function takenSlugs(string $model, string $base, ?int $ignoreId, bool $withTrashed): array
    {
        $query = self::baseQuery($model, $withTrashed);

        // `LIKE` wildcards inside a slug would widen the match; escape
        // them. `Str::slug()` can't emit `%` or `_`, but `$base` also
        // comes from the fallback argument, which callers own.
        $prefix = str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $base);

        $query->where(function ($inner) use ($base, $prefix): void {
            $inner->where('slug', $base)
                ->orWhere('slug', 'like', $prefix.'-%');
        });

        if (null !== $ignoreId) {
            $query->whereKeyNot($ignoreId);
        }

        return array_fill_keys($query->pluck('slug')->all(), true);
    }

    /**
     * First of `$base`, `$base-2`, `$base-3`, … that isn't taken.
     *
     * Bounded by the size of the taken set: with N conflicting rows the
     * answer can be at most the (N+1)-th candidate, so the loop cannot
     * run away even on a maliciously seeded ladder.
     *
     * @param  array<string, true>  $taken
     */
    private static function firstFree(string $base, array $taken): string
    {
        if (! isset($taken[$base])) {
            return $base;
        }

        for ($n = 2; $n <= count($taken) + 2; $n++) {
            $candidate = $base.'-'.$n;

            if (! isset($taken[$candidate])) {
                return $candidate;
            }
        }

        // Unreachable given the bound above; returning the base keeps the
        // signature honest and lets the save-time unique rule be the
        // backstop it already is.
        return $base;
    }

    /**
     * Base query for the collision check, including soft-deleted rows when
     * the model supports them.
     *
     * `method_exists($model, 'withTrashed')` — the previous test — is
     * always false: `withTrashed()` is a *builder* macro registered by
     * `SoftDeletingScope`, not a method on the model. So the preview only
     * ever saw live rows while save-time uniqueness (`Rule::unique`, and
     * the managers' own `uniqueSlug()`) counted trashed ones, and the two
     * disagreed on exactly the slugs a restore could resurrect.
     *
     * @param  class-string<Model>  $model
     *
     * @return Builder<Model>
     */
    private static function baseQuery(string $model, bool $withTrashed): Builder
    {
        if ($withTrashed && in_array(SoftDeletes::class, class_uses_recursive($model), true)) {
            /** @phpstan-ignore-next-line — dynamic scope from the SoftDeletes trait */
            return $model::withTrashed();
        }

        return $model::query();
    }
}
