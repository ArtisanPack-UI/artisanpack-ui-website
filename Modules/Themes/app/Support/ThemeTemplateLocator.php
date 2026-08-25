<?php

declare(strict_types=1);

namespace Modules\Themes\Support;

use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Resolution\TemplateResolver;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;

/**
 * Decides what a public request actually renders: which Blade view wraps
 * the response, and which site-editor block tree goes inside it.
 *
 * Themes come in two shapes and Keystone has to serve both.
 *
 * A *Blade theme* (jmwd-default) ships root-level `*.blade.php` files
 * that own the document and pull block trees in via `<x-ve-blocks>`.
 * `ThemeManager::resolveTemplate()` picks one by WP-style hierarchy.
 *
 * A *block theme* (artisanpack-ui) ships no Blade at all — just
 * `templates/*.html` and `parts/*.html`, the shape cms-framework's site
 * editor is built around. `resolveTemplate()` can't see those: it walks
 * Blade filenames only and hard-falls-back to `index`, so every route
 * died with `View [index] not found`. {@see viewFor()} detects the
 * fallback and swaps in Keystone's own `block-theme` layout.
 *
 * The block-tree side ({@see blocksFor()}) walks the *same* hierarchy
 * against the site-editor store. Keeping the two in step is the point:
 * post rendering previously asked the store for the single hardcoded
 * slug `single`, so a theme's `single-post.html` was never consulted
 * even though the Blade path would have honoured `single-post.blade.php`.
 */
final class ThemeTemplateLocator
{
    /**
     * Keystone-provided layout for themes with no Blade of their own.
     *
     * @see resources/views/block-theme.blade.php
     */
    public const BLOCK_THEME_VIEW = 'block-theme';

    /**
     * Matches the framework's own slug guard. Anything failing it is
     * dropped from the candidate list rather than passed to the
     * resolver, which would reject it anyway.
     */
    private const SLUG_PATTERN = '/^[a-z0-9][a-z0-9_\-]*$/i';

    public function __construct(
        private readonly TemplateResolver $templates,
        private readonly ThemeManager $themes,
    ) {}

    /**
     * The Blade view to render: the active theme's own template when it
     * ships one, otherwise Keystone's block-theme layout.
     *
     * Callers must have run `ThemeManager::registerThemeViewPath()`
     * first, or the theme's own views won't be on the finder.
     */
    public function viewFor(string $contentType, ?string $slug = null): string
    {
        $template = $this->themes->resolveTemplate($contentType, $slug);

        // `resolveTemplate()` returns 'index' both when it genuinely
        // matched `index.blade.php` and when it exhausted the hierarchy
        // without a single hit — `templateExists()` is what separates
        // the two.
        return $this->themes->templateExists($template)
            ? $template
            : self::BLOCK_THEME_VIEW;
    }

    /**
     * The first non-empty block tree in the hierarchy, or `[]` when the
     * theme provides no matching template at all.
     *
     * A candidate that resolves to an empty tree is skipped rather than
     * accepted, so a placeholder DB row saved with no blocks doesn't
     * shadow a populated theme file further down the chain.
     *
     * Both sources produce a usable tree. DB rows carry one already;
     * a theme's `templates/{slug}.html` is parsed on resolve by
     * cms-framework's `ThemeFileBlockParser` (≥ 2.7.2), which delegates
     * to visual-editor's `BlockMarkupHydrator` (≥ 1.5.5) to recover
     * block attributes from the saved HTML — theme files serialize text
     * into the inner HTML rather than an `attributes.content` bag, and
     * the renderer reads the latter. Those two versions are the
     * composer.json floors precisely because a block theme renders
     * structurally correct but textless without them.
     *
     * @return array<int, array<string, mixed>>
     */
    public function blocksFor(string $contentType, ?string $slug = null): array
    {
        foreach ($this->candidates($contentType, $slug) as $candidate) {
            $resolved = $this->templates->resolve($candidate);

            if (null !== $resolved && [] !== $resolved->blocks) {
                return $resolved->blocks;
            }
        }

        return [];
    }

    /**
     * Site-editor template slugs to try, in order — mirroring the list
     * `ThemeManager::resolveTemplate()` walks for Blade files:
     *
     *   1. `single-{contentType}-{slug}`
     *   2. `single-{contentType}`
     *   3. `single`
     *   4. `index`
     *
     * `single` stays in the chain, so installs that authored one in the
     * site editor (jmwd-default's seed among them) resolve as before.
     *
     * @return array<int, string>
     */
    public function candidates(string $contentType, ?string $slug = null): array
    {
        if (! $this->isValidSlug($contentType)) {
            return ['index'];
        }

        $candidates = [];

        if (null !== $slug && $this->isValidSlug($slug)) {
            $candidates[] = "single-{$contentType}-{$slug}";
        }

        $candidates[] = "single-{$contentType}";
        $candidates[] = 'single';
        $candidates[] = 'index';

        return $candidates;
    }

    private function isValidSlug(string $value): bool
    {
        return 1 === preg_match(self::SLUG_PATTERN, $value);
    }
}
