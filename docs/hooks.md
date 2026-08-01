# Keystone Hooks

Keystone extends its own admin, public, auth, installer, updater, CLI, and
API surfaces through the same `artisanpack-ui/hooks` (PHP) and
`@artisanpack-ui/hooks-js` (JS) mechanisms that the CMS Framework and other
ArtisanPack packages use. This document explains the naming rules Keystone
follows for the hooks it fires itself, how to decide between the PHP and JS
sides, and where extension authors should hook in.

## Naming convention

Every hook Keystone emits follows this shape:

```text
keystone.{surface}.{feature}[.{subFeature}…].{event}
```

- `keystone.` — fixed prefix. Mirrors the vendor packages' `ap.{package}.*`
  convention and makes it trivial to grep for every Keystone-owned hook in a
  plugin's dependency graph.
- `{surface}` — one of `admin`, `public`, `auth`, `installer`, `updater`,
  `cli`, `api`, plus the cross-cutting **feature surfaces** whose lifecycle
  doesn't belong to a single runtime (`seo`, `cache`, `plugins`, `themes`).
  Picks the runtime — or the cross-cutting concern — the hook fires on.
  The list is closed: new surfaces need a naming-doc update first.
- `{feature}` — the noun the hook is about (`posts`, `menu`, `plugins`,
  `theme`, `contentTypes`, …). lowerCamelCase. **Optional on surfaces
  whose lifecycle is the surface itself**: `auth` and `updater` emit
  hooks like `keystone.auth.loggedIn` and `keystone.updater.checked`
  because the surface has one lifecycle stream, not a set of features.
  The cross-cutting `cache`, `plugins`, and `themes` surfaces are the
  same shape — `keystone.cache.forgotten`, `keystone.plugins.booted`,
  `keystone.themes.activated`. Every other surface (`admin`, `public`,
  `installer`, `cli`, `api`, `seo`) requires a `{feature}` segment.
- `{subFeature}` — optional nested resource segments when a feature owns
  more than one lifecycle stream (e.g. `contentTypes.record.*` alongside
  `contentTypes.taxonomy.*` — one Content Model surface, several
  independently-versioned resources). Each segment is lowerCamelCase and
  reads left-to-right as a resource path; keep the total to at most one
  or two sub-segments so a plugin author can still eyeball the shape.
- `{event}` — the verb-shaped thing that just happened or is being decided
  (`saved`, `deleted`, `registering`, `rendered`, `defaultStatus`). Also
  lowerCamelCase.

Segments are joined with dots. No underscores, no kebab-case, no colons.

Keystone emit sites pass the full dotted string directly:

```php
doAction('keystone.admin.posts.saved', $post);
```

Renames go through `App\Support\HookAliases` (see below) so old subscribers
keep working.

## PHP vs JS: which side fires the hook?

Keystone renders the initial page from Laravel and then hydrates a React
admin through Inertia. The rule of thumb:

- **PHP / Blade (`doAction` / `applyFilters`, `@action` / `@filter`)** — for
  anything that runs before or during the server-rendered response:
  request handling, controller logic, Inertia prop assembly, Blade
  partials, mail, jobs, artisan commands. If a plugin needs to change what
  the browser receives on first paint, it hooks here.
- **JS (`@artisanpack-ui/hooks-js`)** — for anything that runs after the
  React admin mounts: client-side actions, form UX, admin toolbars, block
  editor extensions, notifications. If a plugin needs to react to a
  post-save toast or extend a React tree that the server never saw, it
  hooks here.

Hooks that need to fire in both places share the same canonical name
(`keystone.admin.posts.saved` fires from PHP after persistence, and from JS
after the Inertia response resolves) so extension authors have a single
term to reason about.

**Veto contract asymmetry.** A handful of JS filters treat literal `false`
as a "suppress" sentinel — subscribers to `keystone.admin.toast.emit`,
`.router.navigate`, the per-resource `.edit.form.beforeSubmit` chains,
`keystone.admin.edit.delete` (plus its `.{resource}.edit.delete` alias),
and `keystone.admin.media.upload.before` (which additionally throws a
`MediaUploadVetoed` error at the caller so a veto is distinguishable
from a network failure) can return `false` to short-circuit the default
behavior. PHP filters do NOT observe this convention: returning `false`
from a PHP subscriber just propagates the value. Plugin authors porting
a JS pattern to PHP (or vice-versa) should check the reference table
below rather than assume symmetry.

## Reference: hooks Keystone fires

| Hook name | Side | Kind | Fired when |
| --- | --- | --- | --- |
| `keystone.admin.contentTypes.record.created` | PHP | action | A dynamic content-type record is inserted via the generic CRUD controller. Args: `(string $slug, array $data, int\|string $id)`. |
| `keystone.admin.contentTypes.record.updated` | PHP | action | A dynamic content-type record is updated. Args: `(string $slug, array $data, int\|string $id)`. `$data` is the submitted-and-column-filtered payload actually written to the row, not a `SELECT *` of the persisted state. |
| `keystone.admin.contentTypes.record.deleted` | PHP | action | Fires after a dynamic content-type record is deleted. Args: `(string $slug, array $row, int\|string $id)` (`$row` is a pre-delete snapshot so subscribers still get the full payload; `[]` if the row could not be re-read). |
| `keystone.admin.contentTypes.record.published` | PHP | action | A dynamic content-type record transitions to `published` on save (first-save-as-published or draft→published). Args: `(string $slug, array $data, int\|string $id)`. |
| `keystone.admin.contentTypes.contentType.created` | PHP | action | A content-type row is created via admin CRUD. Args: `(ContentType $type)`. |
| `keystone.admin.contentTypes.contentType.updated` | PHP | action | A content-type row is updated. Args: `(ContentType $type)`. |
| `keystone.admin.contentTypes.contentType.deleted` | PHP | action | Fires after a content-type row is deleted. Args: `(ContentType $type)` — the pre-delete snapshot. |
| `keystone.admin.contentTypes.customField.registered` | PHP | action | A custom field is created via admin CRUD. Args: `(CustomField $field)`. |
| `keystone.admin.contentTypes.customField.updated` | PHP | action | A custom field is updated. Args: `(CustomField $field)`. |
| `keystone.admin.contentTypes.customField.deleted` | PHP | action | Fires after a custom field is deleted. Args: `(CustomField $field)` — the pre-delete snapshot. |
| `keystone.admin.contentTypes.taxonomy.created` | PHP | action | A taxonomy is created. Args: `(Taxonomy $taxonomy)`. |
| `keystone.admin.contentTypes.taxonomy.updated` | PHP | action | A taxonomy is updated. Args: `(Taxonomy $taxonomy)`. |
| `keystone.admin.contentTypes.taxonomy.deleted` | PHP | action | Fires after a taxonomy (and its terms) are deleted. Args: `(Taxonomy $taxonomy)` — the pre-delete snapshot. Followed immediately by one `.term.deleted` per cascaded term. |
| `keystone.admin.contentTypes.term.created` | PHP | action | A taxonomy term is inserted via the inline term picker. Args: `(DynamicContentTerm $term)`. |
| `keystone.admin.contentTypes.term.deleted` | PHP | action | Fires per-term after a taxonomy's terms are cascade-deleted. Args: `(DynamicContentTerm $term)` — the pre-cascade snapshot. |
| `keystone.admin.comments.created` | PHP | action | A public comment submission was persisted (regardless of moderation outcome). Args: `(Comment $comment)`. |
| `keystone.admin.comments.approved` | PHP | action | A comment was persisted with the `approved` status. Args: `(Comment $comment)`. |
| `keystone.admin.comments.awaitingModeration` | PHP | action | A comment was persisted and is held for moderation. Args: `(Comment $comment)`. |
| `keystone.admin.comments.markedSpam` | PHP | action | A comment was persisted with the `spam` status — either the banned-words match forced it (which beats the `commentsApproval` mode and any `ap.cmsFramework.comments.store.defaultStatus` filter override) or a filter subscriber classified the submission as spam directly. Args: `(Comment $comment)`. |
| `keystone.admin.comments.rejected` | PHP | action | Fires at each pre-persist rejection branch of the public submission flow. Args: `(string $reason, Request $request)`. Reasons: `commentsClosed`, `registrationRequired`, `postNotVisible`, `captchaFailed`, `crossPostReply`, `linkLimit`. |
| `keystone.auth.loggedIn` | PHP | action | A password authentication succeeded, before the 2FA branch decision. Args: `(User $user)`. |
| `keystone.auth.twoFactorChallenged` | PHP | action | A user was redirected to the 2FA challenge after login. Args: `(User $user)`. |
| `keystone.auth.loggedOut` | PHP | action | Fires before session invalidation on both POST logout and the signed GET logout link. Args: `(User $user)`. Skipped when the request has no authenticated user (defensive guard against a broken middleware chain). |
| `keystone.auth.registered` | PHP | action | A user was created via the public registration form, before `Auth::login`. Args: `(User $user)`. |
| `keystone.auth.twoFactorVerified` | PHP | action | A 2FA challenge code was verified successfully. Args: `(User $user)`. |
| `keystone.auth.twoFactorFailed` | PHP | action | A submitted 2FA code failed verification. Args: `(User $user)`. |
| `keystone.auth.passwordReset` | PHP | action | A password reset completed successfully. Args: `(User $user)`. |
| `keystone.auth.emailVerified` | PHP | action | A user's email address was verified for the first time. Args: `(User $user)`. |
| `keystone.admin.users.created` | PHP | action | An admin created a user via the admin UI, after roles are synced. Args: `(User $user)`. |
| `keystone.admin.users.updated` | PHP | action | An admin updated a user via the admin UI, after roles are synced. Args: `(User $user)`. |
| `keystone.admin.users.rolesChanged` | PHP | action | Fires only when a user's assigned role slug set actually changes on save. Args: `(User $user, list<string> $previousSlugs, list<string> $newSlugs)`. |
| `keystone.admin.users.deleting` | PHP | action | Fires immediately before a user row is deleted from the admin. Args: `(User $user)`. |
| `keystone.admin.users.deleted` | PHP | action | Fires after a user row is deleted from the admin. Args: `(User $user)`. |
| `keystone.admin.users.assignableRoles` | PHP | filter | Filters the list of role slugs the current admin/site_owner can assign in the Create/Edit user forms. Args: `(list<string> $slugs, ?User $actor)`; return the (possibly modified) list. |
| `keystone.admin.plugins.installed` | PHP | action | Bridged from `ap.cmsFramework.plugin.installed` — fires after a plugin is installed via admin upload or CLI. Args: `(string $slug, array $plugin)`. |
| `keystone.admin.plugins.activated` | PHP | action | Bridged from `ap.cmsFramework.plugin.activated`. Args: `(string $slug, array $plugin)`. |
| `keystone.admin.plugins.deactivated` | PHP | action | Bridged from `ap.cmsFramework.plugin.deactivated`. Args: `(string $slug)`. |
| `keystone.admin.plugins.updated` | PHP | action | Bridged from `ap.cmsFramework.plugin.updated`. Args: `(string $slug, string $newVersion)`. |
| `keystone.admin.plugins.deleted` | PHP | action | Bridged from `ap.cmsFramework.plugin.deleted`. Args: `(string $slug)`. |
| `keystone.admin.plugins.updateCheckCompleted` | PHP | action | Fires per plugin after the admin-triggered update probe succeeds (regardless of whether an update is available). Args: `(string $slug, ?array $update)` (`$update` is the cached manifest payload, or `null` when the plugin is already current). |
| `keystone.admin.plugins.updateCheckFailed` | PHP | action | Fires per plugin when the admin-triggered update probe throws. Args: `(string $slug, Throwable $exception)`. |
| `keystone.admin.themes.installed` | PHP | action | Fires from `ThemeInstaller::install()` after the theme is placed on disk and the discovery cache is invalidated. Emits at the service layer so CLI/programmatic installs through the Keystone service fire it too. Also bridged from vendor `ap.cmsFramework.theme.installed` in {@see \App\Providers\AppServiceProvider} so vendor-driven installs fire the same hook (the two emit paths never overlap — the Keystone installer doesn't call the vendor installer). Args: `(string $slug, array $manifest)`. |
| `keystone.admin.themes.activated` | PHP | action | A theme was activated via the admin controller. Args: `(string $slug, ?string $previousSlug)` — `previousSlug` is captured before the switch. |
| `keystone.admin.themes.seeded` | PHP | action | Fires from `ThemeSeedApplier::apply()` after `seed.json` is applied to settings/template parts/menus/pages. Skipped on repeat activations (idempotent). Args: `(string $slug, array{settings: int, templateParts: int, menus: int, pages: int})` — the resource counts written. |
| `keystone.admin.themes.uninstalled` | PHP | action | Fires from `ThemeInstaller::uninstall()` after the theme directory is removed. Args: `(string $slug, ?array $manifest)` — the removed theme's pre-uninstall manifest (mirrors the `.installed` payload); `null` if the manifest could not be read. |
| `keystone.admin.settings.saved` | PHP | action | Generic aggregator fired after any settings-panel save. Follows the per-panel emit. Args: `(array{panel: string, diff: array})`. |
| `keystone.admin.settings.privacy.saved` | PHP | action | Fires from `Settings\PrivacyController::update()` after the privacy panel is persisted. Args: `(array{panel: 'privacy', diff: array<string, array{from: mixed, to: mixed}>})`. |
| `keystone.admin.settings.performance.saved` | PHP | action | Fires from `Settings\PerformanceController::update()` after the performance panel is persisted. Args: `(array{panel: 'performance', diff: array<string, array{from: mixed, to: mixed}>})`. |
| `keystone.admin.settings.businessInfo.saved` | PHP | action | Fires from `SiteDesign\BusinessInfoController::update()` after any `global.*` field is written. Args: `(array{panel: 'businessInfo', diff: array<string, array{from: mixed, to: mixed}>})`. |
| `keystone.admin.settings.notificationPreferences.saved` | PHP | action | Fires from `NotificationPreferenceController::update()` after per-user preferences are upserted. Args: `(array{panel: 'notificationPreferences', diff: array{keys: list<string>}})` — the touched notification-type keys (subscribers can re-read the rows for full state). |
| `keystone.admin.settings.seoRedirects.saved` | PHP | action | Fires from `SeoRedirectController::store()`/`update()`/`destroy()` after the redirect cache is cleared. Args: `(array{panel: 'seoRedirects', diff: array{action: 'created'\|'updated'\|'deleted', id: int, from?: array, to?: array}})`. |
| `keystone.admin.settings.configCacheRebuilt` | PHP | action | Fires from `DeferredConfigCacheRebuild::schedule()` after the async `config:cache` rebuild completes, from inside the coalescing mutex. Skipped when another worker holds the lock (their fire covers this write). No args. |
| `keystone.installer.starting` | PHP | action | Fires from `InstallationService::install()` before any step runs. Args: `(InstallationOptions $options)`. `$options` is a redacted clone with every password field (`adminPassword`, `generatedAdminPassword`, `generatedSiteOwnerPassword`) nulled out — plaintext credentials stay on the trusted return path. Every `keystone.installer.*` dispatch is wrapped by an internal `safeDoAction()` guard — a throwing subscriber is recorded on the report as a non-fatal `hook:{name}` step with status `hook_failed` (distinct from `failed`, so the `.installed` flag still writes) and the install continues. |
| `keystone.installer.migrated` | PHP | action | Fires after `runMigrations()`. Args: `(InstallationReport $report)` — inspect the last `migrate` step for status. |
| `keystone.installer.seeded` | PHP | action | Fires after `seedDefaults()` (roles + permissions). Args: `(InstallationReport $report)`. |
| `keystone.installer.siteConfigured` | PHP | action | Fires after `persistSiteConfiguration()` (writes `KEYSTONE_SITE_TYPE`, `site.title`, `site.url`). Args: `(InstallationOptions $options, InstallationReport $report)` — both are redacted clones (password fields nulled). |
| `keystone.installer.themeInstalled` | PHP | action | Fires after `importTheme()`. Args: `(?string $slug, InstallationReport $report)` — `$slug` is `null` when the step was skipped (no zip path) or failed. |
| `keystone.installer.adminCreated` | PHP | action | Fires after `createAdminUser()`. Args: `(User $admin, InstallationReport $report)`. |
| `keystone.installer.siteOwnerCreated` | PHP | action | Fires after `createSiteOwner()`. Args: `(?User $siteOwner, InstallationReport $report)` — `null` when no site-owner email was supplied. |
| `keystone.installer.sitemapGenerated` | PHP | action | Fires after `generateSitemap()`. Args: `(InstallationReport $report)`. |
| `keystone.installer.cached` | PHP | action | Fires after `cacheFramework()` (`config:cache`, `route:cache`, `view:cache`). Args: `(InstallationReport $report)`. |
| `keystone.installer.completed` | PHP | action | Fires at the very end of `install()`, after the `.installed` flag write (if the install succeeded). Args: `(InstallationReport $report)` — a redacted clone with `adminPassword` nulled; every other field (steps, `adminUser`) is intact. The plaintext credential lives only on the report returned to the trusted caller. |
| `keystone.updater.checked` | PHP | action | Fires from `Settings\UpdatesController` after a successful `checkForUpdate()` (both on the show page fetch and the update-run pre-check). Args: `(UpdateInfo $latestInfo)`. |
| `keystone.updater.starting` | PHP | action | Fires immediately before `ApplicationUpdateManager::performUpdate()` runs. Args: `(string $targetVersion, string $currentVersion)`. |
| `keystone.updater.succeeded` | PHP | action | Fires after `performUpdate()` returns cleanly. Args: `(string $targetVersion, string $currentVersion)`. |
| `keystone.updater.failed` | PHP | action | Fires on any updater failure — a check-feed exception or a `performUpdate()` throw. Args: `(string $errorMessage, ?string $targetVersion)` (`$targetVersion` is null when the check itself failed). |
| `keystone.public.head` | PHP | action | Fires inside `<head>` of every server-rendered theme layout. Inject `<meta>`, `<link>`, preconnects, ad-hoc stylesheets. No args. |
| `keystone.public.bodyOpen` | PHP | action | Fires immediately after `<body>` on every theme layout. Skip-nav targets, top-of-page banners, above-the-fold pixels. No args. |
| `keystone.public.footer` | PHP | action | Fires immediately before `</body>` on every theme layout. Deferred scripts, closing pixels, session-scoped notifications. No args. |
| `keystone.public.enqueueScripts` | PHP | action | Fires just before the theme's `@stack('scripts')` flush so plugins can register `@push('scripts', …)` fragments from anywhere in the request. No args. |
| `keystone.public.commentForm.before` | PHP | action | Fires immediately before the rendered `artisanpack/post-comments-form` block on any page that includes it (single-post templates, custom pages). Inject reCAPTCHA, honeypots, or intro copy. Fires from `resources/views/vendor/visual-editor-renderer-blade/blocks/artisanpack/post-comments-form.blade.php` — Keystone's override of the vendor comments-form partial. No args. |
| `keystone.public.commentForm.after` | PHP | action | Fires immediately after the rendered `artisanpack/post-comments-form` block. No args. |
| `keystone.public.post.title` | PHP | filter | Wraps `$post->title` on the theme-authored single-post render path (fires when no site-editor `single` template is set up yet). Args: `(string $title, Post $post)`; return the rewritten title. The theme escapes the return value at the sink (via Blade `{{ }}`) so filter subscribers can rewrite the string but cannot inject HTML. |
| `keystone.public.post.content` | PHP | filter | Wraps the rendered post-content HTML on the theme-authored single-post render path. Args: `(string $html, Post $post)`; return the rewritten HTML. |
| `keystone.admin.shell.head` | PHP | action | Fires inside `<head>` of the admin root Blade (the Inertia mount host). No args. |
| `keystone.admin.shell.bodyOpen` | PHP | action | Fires immediately after `<body>` on the admin root Blade. No args. |
| `keystone.admin.shell.footer` | PHP | action | Fires immediately before `</body>` on the admin root Blade. No args. |
| `keystone.admin.boot` | JS | action | Fires from `resources/js/app.tsx` after `createInertiaApp` resolves. Args: `(InertiaApp)` — the mounted Inertia app instance. Plugin boot modules should use this to grab an app handle for later imperative navigation; hook registration itself should happen at module top level so it's bound before this fires. |
| `keystone.admin.providers` | JS | filter | Wraps the root `<App />` tree in `app.tsx` so plugins can inject cross-cutting providers (i18n, analytics context, feature-flag provider) around the whole admin. Args: `(ReactNode)`; return the (possibly wrapped) tree. Runs OUTSIDE the built-in `ThemeProvider`. |
| `keystone.admin.router.start` | JS | action | Bridged from Inertia `router.on('start', …)`. Args: `(Visit)`. Fires for every navigation, including partial reloads that skip the progress bar. |
| `keystone.admin.router.finish` | JS | action | Bridged from Inertia `router.on('finish', …)`. Args: `(Visit)`. |
| `keystone.admin.layout.wrap` | JS | filter | Wraps the entire `KeystoneAdminLayout` return value. Args: `(ReactNode)`; return the wrapped tree. Use for global chrome — floating widgets, debug panes, banners — that should sit above every admin page without forking the layout. |
| `keystone.admin.error.boundary` | JS | action | Fires from `componentDidCatch` in both `PluginErrorBoundary` and `PanelErrorBoundary`, and from `preloadFederatedBootModules()` on a failed boot-module fetch. Args: `({ scope: 'plugin' \| 'panel' \| 'bootModule', error, info?, pluginName?, pageName?, slug?, module? })`. Use for Sentry/Bugsnag adapters that need to relay caught render errors or preload failures. |
| `keystone.admin.navGroups` | JS | filter | Filters the sidebar's nav-group array in `KeystoneAdminLayout`. Args: `(NavGroup[])`; return the (possibly mutated) list. Runs inside a `useMemo` keyed on `adminMenu`, so callbacks bound after mount pick up on the next menu change or navigation. |
| `keystone.admin.commandPalette.items` | JS | filter | Filters the command-palette item list (Cmd+K) in `KeystoneAdminLayout`. Args: `(CommandPaletteItem[])`. |
| `keystone.admin.topbar.right` | JS | filter | Wraps the right side of the topbar (before the theme toggle / bell). Args: `(ReactNode)` — starting value is `null`. Return the JSX to render. |
| `keystone.admin.notifications.list` | JS | filter | Filters the notification list rendered in the topbar bell. Args: `(NotificationItem[])`. Runs on every render so both the initial-props source and the 30s poll flow through it. |
| `keystone.admin.flash` | JS | filter | Filters the Inertia flash payload (`{ success?, error?, warning?, info? }`) before it's translated into toasts. Args: `(FlashMessages)`. Use to redact/reformat/translate flash messages. |
| `keystone.admin.toast.emit` | JS | filter | Filters each toast payload before it's shown. Args: `({ level, message, source: 'flash' \| 'imperative' })`. Return the (possibly mutated) payload to keep going, or `false` to suppress the toast entirely. |
| `keystone.admin.toast.emitted` | JS | action | Fires after a toast has been shown. Args: same payload as `keystone.admin.toast.emit`. Use for analytics / audit trails. |
| `keystone.admin.router.navigate` | JS | filter | Bridged from Inertia `router.on('before', …)`. Args: `(Visit)`; return the (possibly mutated) visit, or `false` to veto the navigation. Rewrites are copied back onto the live `event.detail.visit`. |
| `keystone.admin.pageProps` | JS | filter | Applied inside `useHookedPage()` (`resources/js/lib/admin/hooks.ts`) — the drop-in replacement for `usePage()` that runs page-shared props through the filter chain. Args: `(props)`. |
| `keystone.admin.theme.change` | JS | action | Fires from `useThemeSync()` after `<html data-theme>` is stamped. Args: `(effectiveScheme: 'light' \| 'dark', { colorScheme, resolvedColorScheme, forceTheme })`. |
| `keystone.admin.theme.tokens` | JS | filter | Applied inside `useAdminPalette()` before CSS custom properties are stamped on `<html>`. Args: `(Record<string, string \| null>)`; set a value to `null` to drop the inline override. |
| `keystone.admin.navItem` | JS | filter | Per-item filter on the sidebar. Args: `(NavItem, { groupLabel })`; return the (possibly rewritten) item or `null` to remove it. |
| `keystone.admin.navItem.badge` | JS | filter | Per-item filter on the nav-item badge text/element. Args: `(badge, item)`. |
| `keystone.admin.navItem.icon` | JS | filter | Per-item filter on the nav-item icon. Args: `(icon, item)`. |
| `keystone.admin.sidebar.footer` | JS | filter | Wraps the sidebar footer slot (built-in is the "Keystone CMS · v{version}" caption, where `version` is `config('app.version')` shared as `keystone.version`). Args: `(ReactNode, { collapsed, version })`. |
| `keystone.admin.topbar.left` | JS | filter | Wraps the left side of the topbar (before the SearchTrigger). Args: `(ReactNode)`; starting value is `null`. |
| `keystone.admin.userMenu.avatar` | JS | filter | Filter the avatar node in the user menu. Args: `(ReactNode, me)`. |
| `keystone.admin.userMenu.items` | JS | filter | Filter the list of items rendered between the identity header and the sign-out button in the user menu. Args: `(UserMenuItem[], me)`. |
| `keystone.admin.commandPalette.search` | JS | filter | Filter the typed query before it's matched against items. Args: `(string, { items })`. |
| `keystone.admin.commandPalette.open` | JS | action | Fires each time the command palette transitions closed→open. No args. |
| `keystone.admin.notifications.item` | JS | filter | Per-item filter on notifications in the bell panel. Args: `(NotificationItem)`; return `null` to drop the notification. |
| `keystone.admin.notifications.markRead` | JS | action | Fires after a single notification is marked read (server ack received). Args: `(id)`. |
| `keystone.admin.notifications.markAllRead` | JS | action | Fires after "mark all read" completes. Args: `(list<number>)` — the ids that were flipped. |
| `keystone.admin.keybindings` | JS | filter | Filter the global admin keybindings registered by `KeystoneAdminLayout`. Args: `(Keybinding[])`. Each binding matches on `key` + optional `meta`/`ctrl`/`shift`/`alt` flags (meta+ctrl are OR'd so Cmd/Ctrl+K matches on both platforms). |
| `keystone.admin.updateBanner` | JS | filter | Wraps / replaces the built-in "update available" dashboard banner. Args: `(ReactNode, KeystoneUpdateAvailable \| null)`; return `null` to suppress. Runs even when no update is pending so a plugin can inject a synthetic banner for its own release channel. |
| `keystone.admin.dataTable.columns` | JS | filter | Filter the columns of every `DataTable` (generic — every list page). Args: `(DataTableColumn[], resource)`. |
| `keystone.admin.{resource}.dataTable.columns` | JS | filter | Resource-scoped variant of the columns filter. `{resource}` is the `resource` prop passed to `<DataTable resource="posts" …>`. |
| `keystone.admin.dataTable.rows` | JS | filter | Filter the rows of every DataTable. Args: `(T[], resource)`. |
| `keystone.admin.{resource}.dataTable.rows` | JS | filter | Resource-scoped rows filter. |
| `keystone.admin.dataTable.rowActions` | JS | filter | Filter the trailing-column row actions for every DataTable. Args: `(DataTableRowAction[], resource)`. Non-empty result adds a trailing actions column. |
| `keystone.admin.{resource}.dataTable.rowActions` | JS | filter | Resource-scoped row actions. |
| `keystone.admin.dataTable.bulkActions` | JS | filter | Filter the bulk (multi-select) actions for every DataTable. Non-empty result adds a checkbox column + selection toolbar. Args: `(DataTableBulkAction[], resource)`. |
| `keystone.admin.{resource}.dataTable.bulkActions` | JS | filter | Resource-scoped bulk actions. |
| `keystone.admin.panels.entries` | JS | filter | Filter the list of `ContentEditEntry` items surfaced in a given AdminEditSlot. Args: `(entries, { slot, contentType, record })`. |
| `keystone.admin.panels.resolved` | JS | filter | Filter the resolved built-in panel component for a given entry. Args: `(ComponentType \| null, entry)`. Return `null` to fall back to the federated / legacy resolver. |
| `keystone.admin.panels.registered` | JS | action | Fires from `registerAdminEditPanel()` after a panel identifier is added to the built-in registry. Args: `(identifier)`. |
| `keystone.admin.dashboard.mount` | JS | action | Fires when the Dashboard page mounts (re-fires on dashboard switch). Args: `({ dashboardId, dashboardSlug })`. |
| `keystone.admin.dashboard.widget.registered` | JS | action | Fires from `registerWidget()` after a widget component is added to the registry. Args: `(key)`. |
| `keystone.admin.edit.form.beforeSubmit` | JS | filter | Fires from post / page Edit screens before `router.put(update…)`. Args: `(payload, { resource, id })`; return the (possibly rewritten) payload, or `false` to veto the submit. **Vetoing is silent by design** — the shell doesn't emit a toast or error, so a subscriber that returns `false` is responsible for its own user feedback (via `useToast()`, a modal, or by rewriting `payload` to a form the server will reject with a visible error). This lets a plugin veto for reasons the shell can't articulate on its behalf (unsaved changes elsewhere, custom validation, feature-flag gating). |
| `keystone.admin.{resource}.edit.form.beforeSubmit` | JS | filter | Resource-scoped variant of the beforeSubmit filter (`posts` and `pages` today). Same silent-veto contract as the generic filter. |
| `keystone.admin.visualEditor.beforeBoot` | JS | action | Fires immediately before `window.ApVisualEditorBoot(document)` in `VisualEditor.tsx`. Args: `(document)`. |
| `keystone.admin.visualEditor.booted` | JS | action | Fires in the boot call's `finally` block regardless of success. Args: `(document)`. |
| `keystone.admin.visualEditor.mediaBridge` | JS | filter | Wraps the `MediaBridge` class before it's registered with the vendor bundle so a plugin can substitute its own bridge (analytics, permission-gating, a custom picker). Args: `(ComponentClass, { uploadMedia })`; return `null` to leave the bundle without a bridge (media blocks fall back to the built-in picker). |
| `keystone.admin.visualEditor.scriptSrc` | JS | filter | Rewrites the visual-editor bundle URL before `ensureScript()` fetches it — useful for CDN-adjacent deployments. Args: `(string, { resource, id })`. Falsy returns fall back to `/visual-editor/visual-editor.js`. |
| `keystone.admin.visualEditor.container.attrs` | JS | filter | Rewrites the mount container's `data-*` attribute set before the visual-editor bundle scans it. Args: `(Record<string, string>, { resource, id })`. Non-`data-` keys and non-string values are dropped so the resulting DOM stays predictable. |
| `keystone.admin.visualEditor.registerBlock` | JS | filter | Passthrough surface — subscribers append block descriptors to the returned array; the collected list is snapshotted to `window.ApKeystoneVisualEditorHooks.registerBlock` right before boot. Args: `(unknown[], { resource, id })`. Consumption by the vendor bundle is deferred; the hook exists so plugins can register subscribers today. |
| `keystone.admin.visualEditor.registerPattern` | JS | filter | Passthrough surface — same contract as `.registerBlock`, snapshotted to `window.ApKeystoneVisualEditorHooks.registerPattern`. Args: `(unknown[], { resource, id })`. |
| `keystone.admin.visualEditor.toolbar.items` | JS | filter | Passthrough surface — same contract as `.registerBlock`, snapshotted to `window.ApKeystoneVisualEditorHooks.toolbarItems`. Args: `(unknown[], { resource, id })`. |
| `keystone.admin.visualEditor.inspector.tabs` | JS | filter | Passthrough surface — same contract as `.registerBlock`, snapshotted to `window.ApKeystoneVisualEditorHooks.inspectorTabs`. Args: `(unknown[], { resource, id })`. |
| `keystone.admin.visualEditor.keybindings` | JS | filter | Passthrough surface — same contract as `.registerBlock`, snapshotted to `window.ApKeystoneVisualEditorHooks.keybindings`. Args: `(unknown[], { resource, id })`. |
| `keystone.admin.dashboard.widgets.available` | JS | filter | Filters the available-widgets catalog before it's consumed by the Dashboard page. Args: `(AvailableWidgets, { dashboardId, dashboardSlug })`. Rewrites propagate to the grid, add-widget drawer, and starter picker on the same render. |
| `keystone.admin.dashboard.widgets.list` | JS | filter | Filters the persisted widget list before renderability/orphan pruning. Args: `(Widget[], { dashboardId, dashboardSlug })`. |
| `keystone.admin.dashboard.widget.register` | JS | action | Fires from `registerWidget()` BEFORE the registry write so observers see intended registrations even when the previous entry is about to be overwritten. Args: `(key, ComponentType)`. Paired with the post-write `.dashboard.widget.registered` action. |
| `keystone.admin.dashboard.widget.render` | JS | filter | Wraps the built-in widget body (component or error placeholder) rendered inside `DashboardGrid`. Args: `(ReactNode, { widget, catalog })`. Return `null` to hide the body while keeping the chrome. |
| `keystone.admin.dashboard.widget.settings.fields` | JS | filter | Runs on the extracted schema field list inside `WidgetSettingsModal` so a plugin can add / remove / reorder settings fields without touching the server-declared schema. Args: `(SchemaField[], { widget, catalog })`. Only fires when the catalog entry declares a `settings_schema`; returning an empty list unmounts the modal. |
| `keystone.admin.dashboard.starters` | JS | filter | Filters the starter list in `StarterPicker` so a plugin can add its own template, hide a shipped one, or reorder. Args: `(DashboardStarter[], { dashboardSlug })`. Empty is legal — the "Start blank" card still renders. |
| `keystone.admin.dashboard.headerActions` | JS | filter | Wraps the trailing action row on the Dashboard PageHeader so a plugin can prepend / append controls or replace the row entirely. Args: `(ReactNode, { dashboardId, dashboardSlug })`. |
| `keystone.admin.dashboard.grid.reorder` | JS | filter | Runs on the caller's optimistic widget-id order in `Dashboard.handleReorderWidgets` so a plugin can veto (return `false` — silent) or rewrite the ordering (e.g. pin a widget to position 0). The rewritten list still has to match the current visible set for the reorder to proceed. Args: `(string[], { dashboardId, dashboardSlug })`. |
| `keystone.admin.dashboard.grid.remove` | JS | filter | Runs on the pending remove in `Dashboard.handleRemoveWidget` BEFORE the confirmation dialog so a plugin can veto (return `false` — silent), rewrite the identifying pair, or suppress the raw `window.confirm` in favor of a themed one. Args: `({ widgetId, widgetTitle }, { dashboardId, dashboardSlug })`. |
| `keystone.admin.settings.tabs` | JS | filter | Filters the tab list in both the site Settings page and the account SettingsLayout. Distinguish surfaces via the second arg — `{ surface: 'account', currentPath }` on the layout, no extra context on the site page. Args: `(SettingsTab[], …)`. A tab whose `key` isn't a built-in is ignored by the tabpanel switch but still renders in the sidebar; pair with `.settings.sections` to render a plugin-owned body. |
| `keystone.admin.settings.sections` | JS | filter | Wraps the rendered panel body on the site Settings page (per active tab) and the section body on the account SettingsLayout. On a plugin-added tab the starting value is `null` so a subscriber can render "from scratch". Args (site page): `(ReactNode, { tab, settings, options })`. Args (account layout): `(ReactNode, { surface: 'account', currentPath })`. |
| `keystone.admin.settings.field.render` | JS | filter | Wraps the field body (control + helper/error) inside the site Settings page's shared `Field` primitive. The label is rendered outside the filter so `htmlFor` stays associated with the underlying control. Args: `(ReactNode, { label, htmlFor, error, helper })`. |
| `keystone.admin.settings.updates.actions` | JS | filter | Wraps the built-in "Update now" action row on `Settings > Updates` so a plugin can prepend controls or replace the button (e.g. an approval-workflow gate). Args: `(ReactNode, { updates, submitting })`. |
| `keystone.admin.roles.permissions.groups` | JS | filter | Filters the grouped permission list rendered in the Role Edit form. The built-in shape is a single unlabeled group; a plugin can split by prefix (e.g. `posts.*` → "Posts") or hide entire clusters. Args: `(PermissionGroup[], { role, permissions })` where `PermissionGroup = { label: string \| null, items: PermissionOption[] }`. |
| `keystone.admin.roles.permissions.row` | JS | filter | Wraps each rendered permission row in the Role Edit form. Return `null` to drop the row silently. Args: `(ReactNode, { permission, group, selected, toggle })`. |
| `keystone.admin.permissions.rows` | JS | filter | Runs on the permissions DataTable's row list on `Permissions > Index` BEFORE the generic `keystone.admin.dataTable.rows` fires. Use to add / hide plugin-owned permission rows on the listing page. Args: `(PermissionRow[])`. |
| `keystone.admin.plugins.card` | JS | filter | Wraps each rendered plugin tile in `system/Plugins.tsx` so a plugin can swap in its own render (a "premium" look, upsell links). Args: `(ReactNode, { plugin, isPending })`. |
| `keystone.admin.plugins.actions` | JS | filter | Wraps the trailing action row inside each plugin card so a plugin can add controls (View settings, Report issue) or gate the built-in Activate / Deactivate / Update / Remove behind a permission check. Args: `(ReactNode, { plugin, isPending })`. |
| `keystone.admin.siteDesign.themes.card` | JS | filter | Wraps each rendered theme tile on `site-design/Themes.tsx`. Args: `(ReactNode, { theme })`. |
| `keystone.admin.siteDesign.businessInfo.fields` | JS | filter | Slot rendered after every built-in card on `site-design/BusinessInfo.tsx` so a plugin can append additional field groups (VAT / tax ID, region-specific fields). Starting value is `null`. The server accepts extra keys silently — wire your controller-side validation before shipping. Args: `(ReactNode, { form })`. |
| `keystone.admin.contentTypes.actions` | JS | filter | Wraps the trailing action row on each content-type tile in `ContentTypes.tsx`. Args: `(ReactNode, { contentType })`. |
| `keystone.admin.contentTypes.form.sections` | JS | filter | Slot rendered inside the content-type create / edit form so a plugin can inject additional field groups. Starting value is `null`. Args: `(ReactNode, { form, mode: 'create' \| 'edit', contentType? })`. |
| `keystone.admin.taxonomies.actions` | JS | filter | Wraps the trailing action row on each taxonomy tile in `Taxonomies.tsx`. Args: `(ReactNode, { taxonomy })`. |
| `keystone.admin.dynamicContent.registerRenderer` | JS | filter | Wraps the built-in `VisualEditor` mount on `DynamicContentEdit` so a plugin can substitute an entirely different editor for specific content types. The starting value is the standard `VisualEditor` node — plugins that don't recognize `contentType.slug` should pass it through unchanged. Args: `(ReactNode, { contentType, record, form })`. |
| `keystone.admin.dynamicContent.editorSections` | JS | filter | Slot rendered between the Attributes card and the editor on `DynamicContentEdit` so a plugin can inject extra editor sections (workflow status, audit trail). Starting value is `null`. Args: `(ReactNode, { form, contentType, record })`. |
| `keystone.admin.customFields.definition.form` | JS | filter | Slot rendered inside the custom-field definition edit form so a plugin can inject extra controls alongside the built-in fields. Starting value is `null`. Args: `(ReactNode, { form, customField, mode: 'edit' })`. |
| `keystone.admin.modal.opened` | JS | action | Fires whenever `useFocusTrap` activates. Since every Keystone modal uses `useFocusTrap`, this is the canonical modal-open signal. Args: `(HTMLElement)` — the trapped container. Subscribers get the same reference passed to `.modal.closed` so `WeakMap<HTMLElement, Session>` pairs open/close deterministically. Drawers / popovers that opt out of `useFocusTrap` need to fire this themselves. |
| `keystone.admin.modal.closed` | JS | action | Fires on the corresponding `useFocusTrap` cleanup (deactivation or unmount). Args: `(HTMLElement)` — the same reference passed to `.modal.opened`. |
| `keystone.admin.confirm` | JS | filter | Pluggable replacement for the raw `window.confirm(message)` used for destructive actions (post/dashboard/widget delete). Callers use the `keystoneConfirm(message)` helper in `resources/js/lib/admin/confirm.ts`. Return `true` to auto-approve without showing the browser dialog, `false` to veto without showing it, or `null` / `undefined` to fall through to the built-in `window.confirm`. The filter is synchronous on purpose — a plugin needing async should render its own dialog ahead of the destructive action. Args: `(null, { message })`. |
| `keystone.admin.focusTrap.mounted` | JS | action | Fires from `useFocusTrap` after the initial focus is placed. Use for aria-live announcements, analytics, or additional focus placement logic that runs alongside the built-in trap. Args: `(HTMLElement, { previouslyFocused, focusableCount })`. |
| `keystone.admin.panels.register` | JS | action | Fires from `registerAdminEditPanel()` immediately BEFORE the identifier is stored. Paired with the post-write `.panels.registered` action. Args: `(identifier, ComponentType)`. |
| `keystone.admin.panels.error` | JS | action | Fires from `PanelErrorBoundary.componentDidCatch` alongside the generic `.error.boundary` action. Args: `({ error, info, slug, pluginName })`. |
| `keystone.admin.tabs.active` | JS | filter | Resolves the initially-active tab slug in `AdminEditTabs` — a plugin can restore per-user tab memory. Runs once per mount. Args: `(slug, { entries })`; return a slug not in `entries` and the tab strip drops back to index 0. |
| `keystone.admin.customFields.registerType` | JS | filter | Resolves a field-type slug to a React editor component in `CustomFieldRenderer`. Runs every render — the filter IS the registry. Args: `(ComponentType \| undefined, { field, type, source })` where `source` is `'custom'`, `'builtin'`, or `'unknown'`. |
| `keystone.admin.customFields.render` | JS | filter | Final wrapper over every custom-field editor. Args: `(ReactNode, { field, value, error })`. |
| `keystone.admin.customFields.section` | JS | filter | Wraps the entire "Custom Fields" card mounted on Edit screens. Args: `(ReactNode, { fields, values, errors })`; return `null` to suppress the section. |
| `keystone.admin.customFields.merge` | JS | filter | Filters the merged custom-field payload right before it's handed to Inertia. Args: `(payload, { fields, dirty })`. Must return `Record<string, FormDataConvertible>`. |
| `keystone.admin.customFields.validate` | JS | filter | Filters the per-field error string before the editor renders it. Args: `(string \| undefined, { field, value })`; return `undefined` to clear. |
| `keystone.admin.featuredImage.value` | JS | filter | Filters the currently-displayed featured-image record on every render. Args: `(FeaturedImageRecord \| null, { context })`; return `null` to render the placeholder without clearing the underlying form field. |
| `keystone.admin.featuredImage.accept` | JS | filter | Filters a freshly-picked media record before it's written to the parent form. Args: `(FeaturedImageRecord, { picked, context })`; return `null` to leave the previous value in place. |
| `keystone.admin.media.upload.before` | JS | filter | Wraps the outgoing upload payload in `resources/js/lib/admin/mediaApi.ts` — rewrite the file (client-side EXIF strip), inject metadata, attach a correlation id. Args: `({ file, metadata }, { onProgress })`; return `false` to veto (throws `MediaUploadVetoed`). |
| `keystone.admin.media.upload.after` | JS | action | Fires only on a successful upload from `mediaApi.uploadMedia`. Args: `(response, { file, metadata })`. |
| `keystone.admin.media.picker.filters` | JS | filter | Filters MediaModal props (allowedTypes, etc.) right before mount. Fires from `FeaturedImagePicker` (component: `'featuredImagePicker'`) and `MediaBridge` (component: `'mediaBridge'`). Args: `(props, { context?, component })`. |
| `keystone.admin.seo.snippet.preview` | JS | filter | Filters a search-snippet preview node rendered at the top of the `SeoMetaCard`. Starts as `null`. Args: `(ReactNode, { value, contextPrefix })`. |
| `keystone.admin.seo.suggestions` | JS | filter | Filters a suggestions node (readability, keyword density) rendered between the search-appearance section and social-sharing. Starts as `null`. Args: `(ReactNode, { value, errors })`. |
| `keystone.admin.seo.fields` | JS | filter | Filters a slot node rendered after the schema/sitemap section — inject extra SEO fields without forking the card. Starts as `null`. Args: `(ReactNode, { value, onChange, errors, contextPrefix })`. |
| `keystone.admin.list.tabs` / `keystone.admin.{resource}.list.tabs` | JS | filter | Plugin-injected tab strip rendered above every `DataTable`. Args: `(ReactNode, resource)`. |
| `keystone.admin.list.filters` / `keystone.admin.{resource}.list.filters` | JS | filter | Plugin-injected filter chip row above every DataTable. Args: `(ReactNode, resource)`. |
| `keystone.admin.list.query` / `keystone.admin.{resource}.list.query` | JS | filter | Filters the caller-supplied `searchQuery` on every render. Writes rewrites back through `onSearchQueryChange` when provided. Args: `(string, resource)`. |
| `keystone.admin.list.empty` / `keystone.admin.{resource}.list.empty` | JS | filter | Filters the empty-state node when a DataTable has zero rows. Args: `(ReactNode, resource)`. |
| `keystone.admin.list.header.actions` / `keystone.admin.{resource}.list.header.actions` | JS | filter | Filters the trailing header-actions node rendered above every DataTable. Args: `(ReactNode, resource)`. |
| `keystone.admin.list.rowClick` / `keystone.admin.{resource}.list.rowClick` | JS | action | Fires when a row is clicked (only when the caller provided `onRowClick`). Args: `(row, resource)`. |
| `keystone.admin.list.selectionChange` / `keystone.admin.{resource}.list.selectionChange` | JS | action | Fires when the selected row-id set changes identity. Args: `(Set<string\|number>, resource)`. |
| `keystone.admin.edit.form.state` / `keystone.admin.{resource}.edit.form.state` | JS | action | Fires per render whenever the form state changes (deep-compared). Args: `(state, { resource, id })`. |
| `keystone.admin.edit.form.validate` / `keystone.admin.{resource}.edit.form.validate` | JS | filter | Filters the error map before the form renders it. Plugins can inject client-side validation. Args: `(errors, { state, resource, id })`. |
| `keystone.admin.edit.form.dirty` / `keystone.admin.{resource}.edit.form.dirty` | JS | action | Fires when the dirty flag transitions. Args: `(boolean, { resource, id })`. |
| `keystone.admin.edit.leaveConfirm` / `keystone.admin.{resource}.edit.leaveConfirm` | JS | filter | Filters the `beforeunload` warning message while the form is dirty. Return `null` to skip. Args: `(string \| null, { isDirty, resource, id })`. |
| `keystone.admin.edit.form.submit` / `keystone.admin.{resource}.edit.form.submit` | JS | action | Fires right before the network write happens — after the `beforeSubmit` filter chain has cleared. Args: `(payload, { resource, id })`. |
| `keystone.admin.edit.form.success` / `keystone.admin.{resource}.edit.form.success` | JS | action | Fires on a successful save (Inertia `onSuccess`). Args: `(response, { resource, id })`. |
| `keystone.admin.edit.form.error` / `keystone.admin.{resource}.edit.form.error` | JS | action | Fires on a failed save (Inertia `onError`). Args: `(errors, { resource, id })`. |
| `keystone.admin.edit.delete` / `keystone.admin.{resource}.edit.delete` | JS | filter | Runs before the delete confirmation dispatches. Return `false` to veto silently. Args: `(record, { resource, id })`. |
| `keystone.admin.edit.deleted` / `keystone.admin.{resource}.edit.deleted` | JS | action | Fires after a delete completes. Args: `(record, { resource, id })`. |
| `keystone.admin.edit.fields` / `keystone.admin.{resource}.edit.fields` | JS | filter | Filters the list of field descriptors an edit screen intends to render. Shape is caller-defined. Args: `(fields, { resource, id })`. |
| `keystone.admin.edit.field.render` / `keystone.admin.{resource}.edit.field.render` | JS | filter | Per-field render wrapper. Args: `(ReactNode, { field, resource, id })`. |
| `keystone.public.render.page.before` | PHP | action | Fires from `PublicPageController::renderPage()` immediately before the theme template renders. Args: `(Page $page)`. |
| `keystone.public.render.page.after` | PHP | action | Fires from `PublicPageController::renderPage()` right after `view($template, $data)` resolves. Args: `(Page $page, View $view)`. |
| `keystone.public.render.blogIndex.before` | PHP | action | Fires from `BlogController::index()` before the Post query runs. No args. |
| `keystone.public.render.blogIndex.after` | PHP | action | Fires from `BlogController::index()` after the Inertia response is built. Args: `(Response $response)`. |
| `keystone.public.render.post.before` | PHP | action | Fires from `BlogController::renderPost()` before the theme template renders. Args: `(Post $post)`. |
| `keystone.public.render.post.after` | PHP | action | Fires from `BlogController::renderPost()` after the Blade view is rendered and the Cache-Tag header is attached. Args: `(Post $post, Response $response)`. |
| `keystone.public.render.viewData` | PHP | filter | Wraps every view-data array before `view($template, $data)` returns on the public surfaces (page + blog index + single post). Args: `(array $data, array $context)` where `$context['surface']` is `'page'`, `'blogIndex'`, or `'post'` and includes the underlying model on the two surfaces that have one. |
| `keystone.public.http.cacheTags` | PHP | filter | Wraps the `Cache-Tag` HTTP header value on the public blog index (`blog:index`) and single-post (`blog:post:{id},blog:index`) responses. Args: `(string $tag, array $context)` with `$context['surface']` = `'blogIndex' \| 'post'`. |
| `keystone.public.blog.index.query` | PHP | filter | Wraps the `Post::query()` builder in `BlogController::index()` so plugin authors can constrain / reorder the public blog index. Args: `(Builder<Post> $query)`. |
| `keystone.public.blog.index.perPage` | PHP | filter | Rewrites the per-page limit applied to the blog index query (default 20). Args: `(int $perPage)`. Clamped to a minimum of 1 at the sink. |
| `keystone.seo.meta.payload` | PHP | filter | Wraps the SEO card payload returned by `SeoMetaSupport::payload()` before it's handed to the React edit screen. Args: `(array $payload, Model $model, ?SeoMeta $seo)`. |
| `keystone.seo.schema.data` | PHP | filter | Wraps the extracted Schema.org data array returned by `KeystoneSchemaService::extractModelData()` before JSON-LD is rendered. Args: `(array $data, Model $model, ?SeoMeta $seoMeta)`. |
| `keystone.seo.social.payload` | PHP | filter | Wraps the OpenGraph + Twitter Card DTOs generated by `KeystoneSocialMetaService` as associative arrays. Fires twice per render with a distinct context marker: `(array $payload, ['kind' => 'openGraph' \| 'twitterCard', 'model' => Model, 'seoMeta' => ?SeoMeta])`. |
| `keystone.seo.aiScrapers.userAgents` | PHP | filter | Wraps the `SeoIntegrationServiceProvider::AI_SCRAPER_USER_AGENTS` list before `config('seo.robots.rules')` is populated. Only applied when the `hide-ai-scrapers` visibility mode is on. Args: `(list<string> $userAgents)`; non-string / empty entries are dropped at the sink. |
| `keystone.seo.sitemap.entries` | PHP | filter | Applied over the `sitemap_entries` rows by `SitemapEntryReconciler` before vendor XML generation (call site: `InstallationService::generateSitemap()`). Args: `(list<array{url,type,is_indexable,priority,changefreq,last_modified}>)`. Rows omitted from the returned list have `is_indexable=false` written back so the vendor `indexable()` scope skips them. Per-row updates to `is_indexable`, `priority`, `changefreq`, `type` are applied; `url` changes and net-new rows are ignored (schema requires a polymorphic FK). |
| `keystone.admin.seo.redirect.created` | PHP | action | Fires from `SeoRedirectController::store()` after the new redirect row is persisted and the redirect cache is cleared. Args: `(Redirect $redirect)`. Follows the per-panel `keystone.admin.settings.seoRedirects.saved` emit. |
| `keystone.admin.seo.redirect.updated` | PHP | action | Fires from `SeoRedirectController::update()` after the row is updated and the redirect cache is cleared. Args: `(Redirect $redirect, array $previous)` — `$previous` is the pre-update snapshot of the mutable columns. |
| `keystone.admin.seo.redirect.deleted` | PHP | action | Fires from `SeoRedirectController::destroy()` after the row is deleted and the redirect cache is cleared. Args: `(int $id, array $snapshot)` — `$snapshot` is the pre-delete column bag. |
| `keystone.admin.seo.meta.updated` | PHP | action | Fires from `SeoMetaSupport::save()` after the SEO meta row is upserted or deleted. Args: `(Model $model, ?SeoMeta $seo)` — `$seo` is null when the save collapsed to a delete. |
| `keystone.cache.forgotten` | PHP | action | Fires at every explicit Keystone-owned `Cache::forget($key)` — `ThemeInstaller::forgetDiscoveryCache()`, `PluginController::checkUpdates()` (per-plugin eviction), `Settings\UpdatesController::update()` (`cms.update_available` post-update). Args: `(string $key)`. Use to mirror the eviction into an edge cache. |
| `keystone.cache.purgeRequested` | PHP | action | Fires at cache-purge trigger points where an edge / CDN cache should be flushed. Emitted from `ThemeController::activate()` (theme swap), `PluginController::activate/deactivate/update()` (plugin lifecycle). Args: `(array{scope: 'page' \| 'theme' \| 'plugin', tags: list<string>})`. |
| `keystone.plugins.booting` | PHP | action | Fires per active plugin from `KeystonePluginManager::loadActivePlugins()` — right before each plugin's autoloader + service provider register. Args: `(string $slug, Plugin $plugin)`. |
| `keystone.plugins.booted` | PHP | action | Fires once from `AppServiceProvider::boot()` via `app()->booted()` after every provider (including plugin providers registered by `.booting`) has finished booting. No args. Subscribers see the fully-wired container. |
| `keystone.themes.activated` | PHP | action | Surface-agnostic complement to `keystone.admin.themes.activated`. Fires from the vendor `ap.cmsFramework.theme.activating` / `.activated` bridge wired in `AppServiceProvider`, so every activation surface (admin controller, installer `importTheme()`, CLI, programmatic) emits the same payload: `(array{previousSlug: ?string, newSlug: string})`. `previousSlug` is snapshotted during the pre-switch `activating` fire. Wrapped in `Hooks::safeDoAction()`. |
| `keystone.admin.plugins.federatedIndex` | JS | filter | Wraps the federated-page routing map in `app.tsx` before Inertia's resolver reads it. Fires on the initial page load and on every SPA navigation manifest. Args: `(FederatedPageManifest, { source: 'initial' \| 'navigate' })`; return the (possibly mutated) map to hide / add / rename entries. |
| `keystone.admin.plugins.federatedPage.beforeMount` | JS | action | Fires inside `resolveFederatedComponent()`'s `lazy` factory the moment the bundle resolves, before React commits it to the tree. Args: `(FederatedModuleEntry entry, ModuleRecord loaded)`. Useful for lazy-loading companion assets alongside the plugin bundle. |
| `keystone.admin.plugins.federatedPage.loadError` | JS | filter | Fires when `loadFederatedPage()` rejects inside `resolveFederatedComponent()`. Args: `(null, { error, entry })`; return `{ default: Component }` to short-circuit into a synthetic module, `null` to keep the throw-into-boundary path. |
| `keystone.admin.plugins.federatedPage.wrap` | JS | filter | Wraps the resolved plugin component in `resolveFederatedComponent()` so a subscriber can inject an HOC (feature-flag gate, tracking wrapper, layout override). Args: `(ComponentType, { entry })`. |
| `keystone.admin.plugins.errorBoundary.render` | JS | filter | Substitutes the fallback UI rendered by `PluginErrorBoundary` when a plugin page throws. Args: `(ReactNode, { error, pluginName, pageName })`; return `null` to render nothing. |
| `keystone.admin.api.request` | JS | filter | Applied inside the shared `apiFetch()` helper (`lib/admin/apiFetch.ts`) over the `RequestInit` for every fetch call in `lib/admin/*Api.ts`. Args: `(RequestInit, { url, method, source })`; return the (possibly mutated) init object. Subscribers can inject headers, add correlation ids, or throw to abort a request. |
| `keystone.admin.api.response` | JS | action | Fires once per successful fetch (any HTTP status — 500 counts as a response) from `apiFetch()`. Args: `(Response, { url, method, source })`. The `Response` is not consumed at the sink so subscribers can `.clone()` to peek at the body. |
| `keystone.admin.api.error` | JS | action | Fires when the underlying `fetch()` rejects inside `apiFetch()` (network failure, aborted, DNS). Args: `(unknown $error, { url, method, source })`. |

## WordPress → Keystone Blade-hook mapping

Plugin authors coming from WordPress can reach for these Keystone
equivalents on the server-rendered HTML surface:

| WordPress hook | Keystone equivalent |
| --- | --- |
| `wp_head` | `keystone.public.head` |
| `wp_body_open` | `keystone.public.bodyOpen` |
| `wp_footer` | `keystone.public.footer` |
| `wp_enqueue_scripts` | `keystone.public.enqueueScripts` |
| `comment_form_before` | `keystone.public.commentForm.before` |
| `comment_form_after` | `keystone.public.commentForm.after` |
| `the_title` (filter) | `keystone.public.post.title` |
| `the_content` (filter) | `keystone.public.post.content` |
| `admin_head` | `keystone.admin.shell.head` |
| `in_admin_header` | `keystone.admin.shell.bodyOpen` |
| `admin_footer` | `keystone.admin.shell.footer` |

## Extending Keystone

### PHP — action

```php
use function ArtisanPackUI\Hooks\addAction;

addAction('keystone.admin.posts.saved', function ($post): void {
    // Reindex, invalidate a cache, notify a webhook…
}, priority: 10);
```

### PHP — filter

```php
use function ArtisanPackUI\Hooks\addFilter;

addFilter('keystone.admin.posts.excerptLength', fn (int $length): int => 240);
```

### JS — action

```ts
import { addAction } from '@artisanpack-ui/hooks-js';

addAction('keystone.admin.posts.saved', (post) => {
    // Post-save UX: refresh a sidebar widget, fire a toast…
});
```

### JS — filter

```ts
import { addFilter } from '@artisanpack-ui/hooks-js';

addFilter('keystone.admin.posts.formActions', (actions, post) => [
    ...actions,
    { id: 'my-plugin.duplicate', label: 'Duplicate', onClick: () => duplicate(post) },
]);
```

## Renaming a hook

When a Keystone-owned hook needs a new name:

1. Update every emit site to the new string.
2. Add the old → new mapping to `App\Support\HookAliases::map()`. Its
   `register()` call from `AppServiceProvider::boot()` will wire the alias
   into the hooks package's deprecation manager, so existing subscribers
   keep firing.
3. Update this document's reference table and note the deprecation window.
