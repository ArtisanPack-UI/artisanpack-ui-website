<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        @if (! empty($siteIcon))
            <link rel="icon" type="{{ $siteIcon['type'] }}" sizes="{{ $siteIcon['sizes'] }}" href="{{ $siteIcon['href'] }}">
            <link rel="apple-touch-icon" href="{{ $siteIcon['href'] }}">
        @else
            <link rel="icon" href="/favicon.ico" sizes="any">
            <link rel="icon" href="/favicon.svg" type="image/svg+xml">
            <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        @endif

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead

        {{-- Plugin injection zone: everything else the admin shell needs
             in <head> (meta, preconnects, ad-hoc stylesheets). --}}
        @action('keystone.admin.shell.head')
    </head>
    <body class="font-sans antialiased bg-base-200 text-base-content">
        {{-- Plugin injection zone: fires immediately after <body>
             opens on the admin shell (skip-nav targets, top-of-page
             pixels, banner overlays). --}}
        @action('keystone.admin.shell.bodyOpen')

        @inertia

        {{-- Web Vitals RUM collector (artisanpack-ui/performance).
             Renders the vendor `@perfMonitor` directive, which emits the
             collector config block + module script tag when
             `artisanpack.performance.monitoring.enabled` is true. Gated
             by `privacyHasConsent('analytics')` when the privacy package
             is enabled so no beacon fires for a visitor who hasn't
             granted analytics consent. When `privacy.enabled` is false,
             the site operator has explicitly opted out of the consent
             regime and RUM fires freely. --}}
        @php
            $keystoneRumConsentRequired = (bool) config('artisanpack.privacy.enabled', true);
            $keystoneRumConsentGranted  = ! $keystoneRumConsentRequired || privacyHasConsent('analytics');
        @endphp
        @if ($keystoneRumConsentGranted)
            {{-- Override the directive's default script src to the
                 Vite-bundled URL — the vendor default assumes a
                 `public/vendor/artisanpack-performance/…` publish path,
                 but the JS lives at `resources/js/vendor/…` under
                 source control (see vite.config.js). --}}
            @perfMonitor(['src' => \Illuminate\Support\Facades\Vite::asset('resources/js/vendor/artisanpack-performance/web-vitals.js')])
        @endif

        {{-- Runtime consent-change bridge. Blade renders once per full
             page load, so mid-session consent changes (visitor accepts
             or revokes analytics via the banner/preferences UI) don't
             re-run the `@if` above on their own. The privacy package
             dispatches a `privacy:consent-updated` window event
             whenever the visitor mutates their consent; we listen for
             it, compare the new analytics state against the state we
             rendered against, and force a full reload when they
             diverge. That way a revoke stops the beacon immediately
             (no more RUM script on the reloaded page) and a grant
             starts it without waiting for the visitor's next
             navigation. Guarded by `privacy.enabled` — when the
             consent regime is off there's nothing to react to. --}}
        @if ($keystoneRumConsentRequired)
            <script>
                (function () {
                    var initial = @json($keystoneRumConsentGranted);
                    window.addEventListener('privacy:consent-updated', function (event) {
                        var current = !!(event && event.detail && event.detail.consents && event.detail.consents.analytics);
                        if (current !== initial) {
                            window.location.reload();
                        }
                    });
                })();
            </script>
        @endif

        {{-- Plugin injection zone: last thing before </body> on the
             admin shell (deferred scripts, session-scoped
             notifications, closing pixels). --}}
        @action('keystone.admin.shell.footer')
    </body>
</html>
