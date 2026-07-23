@php
    $siteTitle = (string) (apGetSetting('site.title') ?: config('app.name'));
@endphp
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{{ __('Password required') }} &mdash; {{ $siteTitle }}</title>
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
            max-width: 24rem;
            background: #fff;
            border-radius: 0.75rem;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
            padding: 2rem;
        }
        h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
        p.lead { margin: 0 0 1.5rem; color: #6b7280; font-size: 0.875rem; }
        label { display: block; font-size: 0.8125rem; font-weight: 600; margin-bottom: 0.375rem; }
        input[type="password"] {
            width: 100%;
            height: 2.5rem;
            padding: 0 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 0.5rem;
            font-size: 0.9375rem;
        }
        input[type="password"]:focus { outline: none; border-color: #2563eb; }
        .error { color: #dc2626; font-size: 0.8125rem; margin-top: 0.5rem; }
        button {
            margin-top: 1.25rem;
            width: 100%;
            height: 2.5rem;
            border: 0;
            border-radius: 0.5rem;
            background: #2563eb;
            color: #fff;
            font-weight: 600;
            font-size: 0.9375rem;
            cursor: pointer;
        }
        button:hover { background: #1d4ed8; }
        @media (prefers-color-scheme: dark) {
            body { background: #0b0f19; color: #e5e7eb; }
            .card { background: #111827; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4); }
            p.lead { color: #9ca3af; }
            input[type="password"] { background: #1f2937; border-color: #374151; color: #e5e7eb; }
        }
    </style>
</head>
<body>
    <main class="card">
        <h1>{{ $siteTitle }}</h1>
        <p class="lead">{{ __('This site is password protected. Enter the password to continue.') }}</p>
        <form method="POST" action="{{ route('site-password.verify') }}">
            @csrf
            <label for="site-password-input">{{ __('Password') }}</label>
            <input
                id="site-password-input"
                type="password"
                name="password"
                autocomplete="off"
                autofocus
                required
            >
            @error('password')
                <div class="error">{{ $message }}</div>
            @enderror
            <button type="submit">{{ __('Enter') }}</button>
        </form>
    </main>
</body>
</html>
