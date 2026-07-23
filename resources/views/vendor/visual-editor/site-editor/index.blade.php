<!DOCTYPE html>
{{-- Keystone override of `visual-editor::site-editor.index`.

	The package's bundled blade uses `@vite()` against
	`resources/js/visual-editor/site-editor/main.tsx` — a path that
	exists in the package repo but NOT in consumer apps like Keystone.
	The package's vite.config.ts comment documents the consumer
	deployment pattern: copy `dist/editor/*` into `public/visual-editor/`
	and load the prebuilt `site-editor.js` directly. We mirror that
	here.

	The dist symlink at `public/visual-editor` points at
	`vendor/artisanpack-ui/visual-editor/dist/editor`, so the editor
	tracks whatever build the installed package version shipped.

	Mount markup mirrors the package's own blade: same data attributes,
	same `[data-ap-site-editor]` selector the SPA looks for. --}}
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="csrf-token" content="{{ csrf_token() }}">
	<title>{{ config('app.name') }} — Site Editor</title>
	<script type="module" src="{{ asset('visual-editor/site-editor.js') }}"></script>
</head>
<body class="ap-visual-editor-site-editor-body">
	{{-- #43: the SPA is served at `/admin/site-editor`, so `data-route-base`
	     is the Keystone admin URL — the package's SPA treats it as the
	     single source of truth for client-side routing. The exit link
	     points back at the Keystone admin dashboard (visual-editor #446
	     made the exit link consumer-configurable). --}}
	<div
		id="ap-visual-editor-site-editor"
		data-ap-site-editor
		data-route-base="/admin/site-editor"
		data-exit-url="{{ route('admin.dashboard') }}"
		data-exit-label="{{ __('← Dashboard') }}"
		data-api-base="/visual-editor/api"
		data-theme="{{ config('artisanpack.visual-editor.global_styles.theme', 'default') }}"
	></div>
</body>
</html>
