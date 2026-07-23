{{--
    Default template. Renders header + page content + footer through the
    visual-editor's Blade renderer, which resolves the `core/template-part`
    references against the jmwd-default rows in `template_parts`.
--}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    {{--
        SEO output is delegated to artisanpack-ui/seo. `<x-seo:meta>` walks
        the Page/Post SeoMeta morph (wired by SeoIntegrationServiceProvider),
        falls back to the model's title/excerpt, then to the SEO package's
        config — which in turn reads from Keystone's `seo.*` admin settings.
        The component emits <title>, meta description, robots, canonical,
        Open Graph, and Twitter Card tags in one pass; `<x-seo:schema>` adds
        the JSON-LD structured data when the schema toggles are on.
    --}}
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
    {{--
        Form-island assets ahead of the theme stylesheet so the scoped
        Tailwind/daisyUI build lays down the form's base structure and
        the theme's `style.css` (loaded immediately after) wins the
        cascade for any rules it chooses to override.

        Emits both the CSS link (from `resources/css/keystone-form-island.css`,
        imported by the entry's TSX) and a deferred `<script type="module">`
        for the island hydrator. The keystone-form blade component still
        calls `@vite([...])` inside a `@once` block for safety, but the
        vite plugin de-dupes entries across the request so this remains
        the single emission site for theme-rendered pages.
    --}}
    @viteReactRefresh
    @vite(['resources/js/keystone-form-island.tsx'])
    @if ($activeTheme)
        <link rel="stylesheet" href="{{ route('themes.asset', ['theme' => $activeTheme, 'path' => 'style.css']) }}">
    @endif
</head>
<body>
    <x-ve-blocks :tree="$headerBlocks" :default-theme="$activeTheme" />

    {{--
        `wp-block-post-content is-layout-constrained` opts this <main>
        into renderer-blade's WP-FSE-style page layout (Keystone #50).
        Children get the canonical alignment behavior: default →
        content-size (720px), `alignwide` → wide-size (1200px),
        `alignfull` → full-bleed. Without these classes a section
        with `align="none"` stretches full-width because nothing sizes
        the parent.
    --}}
    <main class="wp-block-post-content is-layout-constrained">
        <x-ve-blocks :tree="$page->getBlockContent()" :default-theme="$activeTheme" />

        {{--
            Demo: inline-render a Forms-package form named with the same
            slug as the current page (e.g. a Page with slug "contact"
            picks up a Form with slug "contact"). Lets the visual editor
            stay block-only while themes still get a turnkey way to drop
            a lead-capture form below the page content.
        --}}
        @if (\ArtisanPackUI\Forms\Models\Form::query()->where('slug', $page->slug)->where('is_active', true)->exists())
            <section class="wp-block-post-content is-layout-constrained mt-12">
                <x-keystone-form :form-slug="$page->slug" class="mx-auto max-w-2xl" />
            </section>
        @endif
    </main>

    <x-ve-blocks :tree="$footerBlocks" :default-theme="$activeTheme" />
</body>
</html>
