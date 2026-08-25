@php
    $siteTitle = (string) (apGetSetting('site.title') ?: config('app.name'));
    $adminUrl  = route('admin.dashboard');
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{{ __('Welcome') }} &mdash; {{ $siteTitle }}</title>
    @isset($siteIcon)
        @if ($siteIcon)
            <link rel="icon" href="{{ $siteIcon['href'] }}" type="{{ $siteIcon['type'] }}" sizes="{{ $siteIcon['sizes'] }}">
        @endif
    @endisset
    <style>
        :root { color-scheme: light dark; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            background: #f3f4f6;
            color: #111827;
        }
        .card {
            width: 100%;
            max-width: 30rem;
            background: #fff;
            border-radius: 0.75rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
            padding: 2.5rem;
            text-align: center;
        }
        h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
        p.lead { margin: 0 0 1.75rem; color: #6b7280; font-size: 0.9375rem; line-height: 1.6; }
        a.cta {
            display: inline-block;
            padding: 0 1.5rem;
            height: 2.75rem;
            line-height: 2.75rem;
            border-radius: 0.5rem;
            background: #2563eb;
            color: #fff;
            font-weight: 600;
            font-size: 0.9375rem;
            text-decoration: none;
        }
        a.cta:hover { background: #1d4ed8; }
        p.footnote { margin: 1.75rem 0 0; color: #9ca3af; font-size: 0.75rem; }
        @media (prefers-color-scheme: dark) {
            body { background: #0b0f19; color: #e5e7eb; }
            .card { background: #111827; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4); }
            p.lead { color: #9ca3af; }
            p.footnote { color: #6b7280; }
        }
    </style>
</head>
<body>
    <main class="card">
        <h1>{{ $siteTitle }}</h1>
        <p class="lead">{{ __('No homepage has been published yet. Sign in to the admin dashboard to build your first page.') }}</p>
        <a class="cta" href="{{ $adminUrl }}">{{ __('Go to the dashboard') }}</a>
        <p class="footnote">{{ __('Powered by Keystone') }}</p>
    </main>
</body>
</html>
