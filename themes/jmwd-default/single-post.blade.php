{{--
    Single post template. Renders the site-editor's `single` template
    (DB-stored block tree, authored in `/admin/site-editor`) through the
    visual-editor Blade renderer with `$post` in scope so PostResolver
    stamps the post-* and post-comments-* blocks and CommentInliner
    expands `artisanpack/comments` against `$post->comments`.

    Falls back to `$post->getBlockContent()` when no `single` template
    has been authored yet — keeps the route renderable on a fresh
    install.
--}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <x-seo:meta :model="$post" />
    <x-seo:schema :model="$post" />
    @if (! empty($siteIcon))
        <link rel="icon" type="{{ $siteIcon['type'] }}" sizes="{{ $siteIcon['sizes'] }}" href="{{ $siteIcon['href'] }}">
        <link rel="apple-touch-icon" href="{{ $siteIcon['href'] }}">
    @else
        <link rel="icon" sizes="any" href="{{ asset('favicon.ico') }}">
        <link rel="icon" type="image/svg+xml" href="{{ asset('favicon.svg') }}">
    @endif
    <x-ve-blocks-styles :theme-json="$themeJson" />
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

    <x-ve-blocks :tree="$headerBlocks" :default-theme="$activeTheme" :post="$post" />

    @if (session('comment_success') || session('comment_error'))
        {{-- Sticky-top banner so the redirect-with-anchor (#comments)
             still shows the flash even though the browser scrolls
             past the top of the page. --}}
        <div
            style="position:sticky;top:0;z-index:50;padding:0.75em 1em;text-align:center;font-weight:600;{{ session('comment_success') ? 'background:#dcfce7;color:#14532d;' : 'background:#fee2e2;color:#7f1d1d;' }}"
            role="{{ session('comment_success') ? 'status' : 'alert' }}"
        >
            {{ session('comment_success') ?? session('comment_error') }}
        </div>
    @endif

    <main class="wp-block-post-content is-layout-constrained">
        @if (! empty($templateBlocks))
            {{-- Site-editor `single` template: layout-level blocks
                 (post-title, post-content, comments, etc.) stamped with
                 `$post`. PostResolver + CommentInliner run inside the
                 <x-ve-blocks> component. --}}
            <x-ve-blocks :tree="$templateBlocks" :default-theme="$activeTheme" :post="$post" />
        @else
            {{-- Fallback when no `single` template is authored yet:
                 render the post's own title and block content directly.
                 The post-* entity blocks won't have any place to
                 resolve from in this path — the template-authored
                 layout is required for the FSE-style render.

                 The `keystone.public.post.title` and `.post.content`
                 filters give plugin authors the WP `the_title` /
                 `the_content` analogs on the theme-authored render
                 path. --}}
            {{-- Escape the filtered title at the sink. `@filter` echoes the
                 raw `applyFilters` return value, which would otherwise
                 create a stored XSS surface for any editor able to author
                 a post title. Filter subscribers can still transform the
                 string; they just can't inject HTML. --}}
            <h1 class="entry-title">{{ applyFilters('keystone.public.post.title', $post->title, $post) }}</h1>
            @php
                ob_start();
            @endphp
            <x-ve-blocks :tree="$post->getBlockContent()" :default-theme="$activeTheme" :post="$post" />
            @php
                $keystonePostContentHtml = (string) ob_get_clean();
            @endphp
            {!! applyFilters('keystone.public.post.content', $keystonePostContentHtml, $post) !!}
        @endif
    </main>

    <x-ve-blocks :tree="$footerBlocks" :default-theme="$activeTheme" :post="$post" />

    {{-- Plugin injection zone: WP-style `wp_enqueue_scripts` analog. --}}
    @action('keystone.public.enqueueScripts')
    @stack('scripts')

    {{-- Plugin injection zone: WP-style `wp_footer` analog. --}}
    @action('keystone.public.footer')
</body>
</html>
