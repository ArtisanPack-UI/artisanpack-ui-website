<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Foundation\Vite;
use InvalidArgumentException;

/**
 * Maps an Inertia page key onto the Vite entry that builds it.
 *
 * `app.blade.php` eager-loads the current page's chunk alongside
 * `app.tsx` so the browser doesn't wait for `app.tsx` to parse before it
 * discovers which page to fetch. That entry is a **Vite manifest key**,
 * which is the page's source path relative to the project root — so it
 * cannot be assumed to live under `resources/js/pages` once pages start
 * moving into modules (plans/14-modular-laravel-setup.md §3.4).
 *
 * The page roots come from `inertia.pages.paths` (Inertia v3 moved them
 * there from the old top-level `inertia.page_paths`), the same list the
 * server-side page-existence check uses, so there is exactly one place
 * that knows where pages can live. Core is listed first, matching the
 * precedence `resources/js/lib/resolve-page.ts` applies on the client.
 *
 * This only bites in a built bundle: when `public/hot` is present Laravel
 * serves every asset straight off the Vite dev server and never opens the
 * manifest, so a wrong entry here is invisible under `npm run dev` and
 * throws `ViteException` in production and CI. `ModularSetupTest` walks
 * every page key on disk through {@see self::resolve()} to catch it
 * without needing a build.
 */
final class InertiaPageEntry
{
    private const PAGE_EXTENSION = '.tsx';

    /**
     * Resolve the Vite entry for an Inertia page key.
     *
     * Falls back to the core `resources/js/pages` path when no root owns
     * the key — federated plugin pages have no file in any root, and an
     * unresolvable key should fail exactly the way it did before modules
     * existed rather than silently dropping the preload.
     *
     * @throws InvalidArgumentException when the key is malformed. A page
     *                                  key that can't name a file under a
     *                                  pages root is a programming error,
     *                                  and it would otherwise surface as a
     *                                  confusing "missing from the Vite
     *                                  manifest" further down the stack.
     */
    public static function resolve(string $component): string
    {
        $relative = self::normalize($component);

        if (null === $relative) {
            throw new InvalidArgumentException(
                "Invalid Inertia page key [{$component}]: page keys are slash-separated "
                .'names relative to a pages root and may not contain "." or ".." segments.',
            );
        }

        $candidates = [];

        foreach ((array) config('inertia.pages.paths', []) as $root) {
            $absolute = rtrim((string) $root, '/').'/'.$relative.self::PAGE_EXTENSION;

            if (is_file($absolute)) {
                $candidates[] = self::relativeToBase($absolute);
            }
        }

        // On a site updated in place, more than one candidate can exist for a
        // key: the self-updater overlays the release without deleting what the
        // release removed, so a page that moved into a module leaves its
        // pre-move copy behind under `resources/js/pages`. Disk order alone
        // would keep choosing that orphan — and it is not in the manifest,
        // because the release was built from a tree that no longer contains
        // it, so every such page 500s with `ViteException`. Nearly every page
        // moved in 0.4.0, which made this the whole admin.
        //
        // The manifest is the authority on which candidate is real: this
        // method exists to return a manifest KEY, so a candidate the manifest
        // doesn't list cannot be the right answer. Consulted only when a built
        // manifest is present — under `npm run dev` there is none and disk
        // order is all we have (and all we need, since the dev server serves
        // by path and a dev checkout has no orphans).
        $manifest = self::manifest();

        if (null !== $manifest) {
            foreach ($candidates as $candidate) {
                if (isset($manifest[$candidate])) {
                    return $candidate;
                }
            }
        }

        return $candidates[0] ?? 'resources/js/pages/'.$relative.self::PAGE_EXTENSION;
    }

    /**
     * The built Vite manifest, or null when there isn't one to consult.
     *
     * Returns null under `npm run dev` (Laravel bypasses the manifest whenever
     * `public/hot` exists) and when no build has run.
     *
     * Deliberately not memoized: {@see self::resolve()} is called once per
     * rendered page, so a cache would save nothing and would only make the
     * manifest look frozen to anything that swaps it mid-process.
     *
     * Laravel keeps the build directory and manifest filename protected with
     * no accessor, so the framework defaults are assumed. A site that has
     * customised either simply gets null here and falls back to disk order —
     * the behaviour this method was added to improve on, never worse than it.
     *
     * @return array<string, mixed>|null
     */
    private static function manifest(): ?array
    {
        if (is_file(app(Vite::class)->hotFile())) {
            return null;
        }

        $path = public_path('build/manifest.json');

        if (! is_file($path)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * Reject anything that could escape a pages root.
     *
     * Page keys are authored by controllers, not visitors, but this
     * builds a path that reaches the Vite dev server verbatim under
     * `npm run dev` — a `..` segment arriving through a plugin that
     * renders a computed key should not be able to point outside
     * `pages/`. Returns null when the key is unusable.
     */
    private static function normalize(string $component): ?string
    {
        $component = str_replace('\\', '/', $component);

        if ('' === $component || str_starts_with($component, '/')) {
            return null;
        }

        foreach (explode('/', $component) as $segment) {
            if ('' === $segment || '.' === $segment || '..' === $segment) {
                return null;
            }
        }

        return $component;
    }

    /**
     * Express an absolute page path as a Vite manifest key.
     */
    private static function relativeToBase(string $absolute): string
    {
        $base = rtrim(base_path(), '/').'/';

        return str_starts_with($absolute, $base)
            ? substr($absolute, strlen($base))
            : $absolute;
    }
}
