{{--
    Keystone's render target for block themes.

    `ThemeManager::resolveTemplate()` only ever looks for root-level
    `*.blade.php` files in the active theme and hard-falls-back to the
    name `index` when it finds none. A pure block theme — one that ships
    `templates/*.html` + `parts/*.html` and no Blade at all, which is the
    shape cms-framework's site editor is built around — therefore
    resolved to a view name nothing on disk provides, and every
    theme-rendered route died with `View [index] not found`.

    `ThemeTemplateLocator::viewFor()` detects that case and names this
    layout instead; `PublicPageController::renderPage()` and
    `BlogController::renderPost()` both resolve their view through it.
    It supplies the document chrome a Blade theme would have
    hand-written — SEO head, theme.json tokens, stylesheet, hook zones —
    then hands the resolved template's block tree to the visual-editor
    renderer.

    Header and footer are NOT emitted separately here: a block theme's
    template carries its own `wp:template-part` references, and the
    inliner expands them in place. Emitting `$headerBlocks` around the
    tree as the Blade themes do would double them up. They're only used
    on the fallback path at the bottom, which covers a theme that ships
    parts but no template matching the hierarchy — rendering the
    record's own content keeps such an install viewable rather than
    returning an empty document.
--}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    {{-- `$page` is the SEO subject on both surfaces: BlogController
         aliases it to the post so this layout needs no branch. --}}
    <x-seo:meta :model="$page" />
    <x-seo:schema :model="$page" />

    @if (! empty($siteIcon))
        <link rel="icon" type="{{ $siteIcon['type'] }}" sizes="{{ $siteIcon['sizes'] }}" href="{{ $siteIcon['href'] }}">
        <link rel="apple-touch-icon" href="{{ $siteIcon['href'] }}">
    @else
        <link rel="icon" sizes="any" href="{{ asset('favicon.ico') }}">
        <link rel="icon" type="image/svg+xml" href="{{ asset('favicon.svg') }}">
    @endif

    <x-ve-blocks-styles :theme-json="$themeJson" />

    {{-- Form-island assets ahead of the theme stylesheet so the theme's
         `style.css` wins the cascade over the scoped form build. --}}
    @viteReactRefresh
    @vite(['resources/js/keystone-form-island.tsx'])

    @if ($activeTheme)
        <link rel="stylesheet" href="{{ route('themes.asset', ['theme' => $activeTheme, 'path' => 'style.css']) }}">
    @endif

    {{-- Plugin injection zone: WP-style `wp_head` analog. --}}
    @action('keystone.public.head')
</head>
<body>
    {{-- Plugin injection zone: WP-style `wp_body_open` analog. --}}
    @action('keystone.public.bodyOpen')

    @if (! empty($templateBlocks))
        {{-- The theme template owns the whole document body, header and
             footer template-parts included. `:post` is null on the page
             surface; the component defaults it, and PostResolver simply
             leaves post-* blocks unstamped. --}}
        <x-ve-blocks
            :tree="$templateBlocks"
            :default-theme="$activeTheme"
            :post="$post ?? null"
        />
    @else
        {{-- No template resolved anywhere in the hierarchy — a theme
             mid-install, or one shipping parts but no templates. Render
             the record's own block content between whatever header and
             footer parts do resolve, so the route stays viewable
             instead of returning an empty document. --}}
        <x-ve-blocks :tree="$headerBlocks" :default-theme="$activeTheme" :post="$post ?? null" />

        <main class="wp-block-post-content is-layout-constrained">
            <x-ve-blocks
                :tree="$page->getBlockContent()"
                :default-theme="$activeTheme"
                :post="$post ?? null"
            />
        </main>

        <x-ve-blocks :tree="$footerBlocks" :default-theme="$activeTheme" :post="$post ?? null" />
    @endif

    {{-- Plugin injection zone: WP-style `wp_enqueue_scripts` analog.
         Fires before the `@stack('scripts')` flush so plugins can
         `@push('scripts', …)` from anywhere in the request. --}}
    @action('keystone.public.enqueueScripts')
    @stack('scripts')

    {{-- Plugin injection zone: WP-style `wp_footer` analog. --}}
    @action('keystone.public.footer')
</body>
</html>
