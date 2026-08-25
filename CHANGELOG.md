# Changelog

All notable changes to Keystone CMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-08-22

### Added

- **Full-width and distraction-free editor view modes.** The post, page, and
  dynamic-content editors gain a view-mode switcher: a full-width canvas and a
  distraction-free mode that hides the admin chrome. The mode is persisted
  per-user, per-post-type (#239).

### Changed

- **Upgraded `squizlabs/php_codesniffer` to `^4.0`** (from `^3.13`) and bumped
  `artisanpack-ui/code-style` to `^1.2`, whose `^3.7 || ^4.0` constraint unblocks
  the PHPCS 4.x upgrade. The `ArtisanPackUIStandard` coding standard is validated
  under PHPCS 4.x. Resolves the last of the deferred v0.3.0 major-version
  dependency upgrades (#200).
- **Upgraded `artisanpack-ui/cms-framework` to 2.9.0.**

### Fixed

- **The sitemap no longer lists non-public content.** Draft, scheduled, and
  private posts and pages are excluded from the generated sitemap (#234).
- **`Update` is no longer silently dropped while the block editor is mounting.**
  Clicking Update (or pressing Enter) on a post or page before the visual editor
  finished loading could swallow the save with no request, error, or
  confirmation. The primary Save now carries a pending state and is gated on the
  editor's readiness — per record — so an early click waits for the editor
  instead of being lost. Applied to the post, page, and dynamic-content editors
  (#237).

## [0.5.1] - 2026-08-15

**Update to this release, not 0.5.0.** v0.5.0 shipped with a `composer.lock`
whose content hash did not match `composer.json` — the `version` bump was not
followed by `composer update --lock`, and composer folds `version` into the
lock's content hash. cms-framework's self-updater runs
`verifyComposerFilesInSync()` after extracting the release archive and aborts
when the two disagree (it cannot reconcile a mismatch — `composer install` only
reads a lock), leaving the site in a failed-update state. This is the same
failure mode as v0.4.0. No application behaviour changed; 0.5.1 is 0.5.0 with a
re-synced lock.

### Fixed

- **`composer.lock` content hash re-synced with `composer.json`** so the
  self-updater installs the release instead of aborting on a lock/json mismatch.

## [0.5.0] - 2026-08-15

### Changed

- **Upgraded Inertia from v2 to v3** (`inertiajs/inertia-laravel` 2.0.25 → 3.3.1,
  `@inertiajs/react` 2.x → 3.6.1). The server adapter and client package share a
  protocol version and must move together. Inertia is the admin UI's entire
  transport layer, so the whole modular page surface — 70 `Inertia::render()`
  call sites, every `.layout` persistent-layout assignment, the SSR entry, and
  the real-browser round-trip — was verified against the Unit, Feature, and
  Browser suites.

  The migration was mostly config- and typing-level rather than a rewrite of
  page code:

  - **`config/inertia.php` restructured to the v3 shape.** v3 reads page roots
    from `inertia.pages.paths` and removed the old top-level `inertia.page_paths`
    and `inertia.testing.page_paths` keys. The load-bearing core-plus-modules
    page-root glob (what makes `assertInertia()->component('admin/…')` resolve a
    page that has moved into a module) moved into `pages.paths` unchanged.
    `App\Support\InertiaPageEntry::resolve()`, which reads the same list to emit
    each page's `@vite()` manifest entry, was repointed at `inertia.pages.paths`
    — without this it fell back to the core path for every module-owned page.

  - **`<title inertia>` → `<title data-inertia>`** in `app.blade.php`: v3's head
    manager owns the title element via the `data-inertia` attribute.

  - **The client `resolve` callback now returns the page component directly**
    (`Promise<ReactComponent>`) rather than the raw module record. v3's stricter
    `ComponentResolver` type no longer accepts `Promise<{ default }>`, though the
    runtime still tolerates it.

  The v2 render-prop layout form — `Page.layout = (page) => <Layout>{page}</Layout>`
  — is still supported in v3, so the ~57 page layout assignments were left as-is.
  No page relied on the removed `Inertia::lazy()`, the renamed `invalid` /
  `exception` events, `router.cancel()`, Axios, or the `future` config namespace.

- **Upgraded the Pest testing stack from v4 to v5** (`pestphp/pest` 4.7.8 → 5.1.1,
  `pestphp/pest-plugin-browser` 4.3.1 → 5.0.1, `pestphp/pest-plugin-laravel`
  4.1.0 → 5.0.1). The three packages share a major-version line and were bumped
  together; upgrading `pest` alone fails to resolve against the 4.x plugins.

  Pest 5 is built on **PHPUnit 13**, so the transitive `phpunit/phpunit`
  12.5 → 13.3 and `brianium/paratest` 7.20 → 7.24 bumps came along with it. The
  codebase used none of the APIs PHPUnit 13 removed (`Assert::isType()`,
  `assertContainsOnly()`, `#[RunClassInSeparateProcess]`, the
  `--dont-report-useless-tests` flag), and the `phpunit.xml` testsuite
  definitions (`Unit`, `Feature`, `Browser`) and `<source>` config needed no
  changes. `->flaky(tries: n)`, used throughout the browser editor suite, is
  still supported.

  The Unit + Feature (1560 tests, 3 skipped) and Browser (129 tests) suites both
  pass against Pest 5, the browser suite still requiring `npm run build:ssr`
  ahead of the run exactly as the `browser_test` CI job does.

  The root `composer.json` PHP requirement was raised `^8.3` → `^8.4.1` to match.
  Pest 5 / PHPUnit 13 need PHP `^8.4`, and the already-locked Symfony 8.1
  components require `>=8.4.1`, so the previous `^8.3` constraint was inaccurate
  and a `composer install` under PHP 8.3 would fail to resolve. The application
  already runs on PHP 8.4 in CI and production; this only makes the declared
  floor honest.

- Bumped `artisanpack-ui/cms-framework` to 2.8.0 (constraint `^2.7.2`) and
  re-captured the route baseline against it.

### Fixed

- **Media uploads now accept the extended MIME types the validator advertises**,
  instead of failing with a missing `MediaStoreRequest` class (#117).
- **A fresh install renders a placeholder at `/`** when no homepage has been
  published yet, rather than returning a 404 (#116).
- **The release zip now ships the `storage/framework/{views,sessions,cache}`
  runtime directories**, and the installer ensures they exist, so the first
  artisan/cache call on a freshly unzipped install no longer fails (#115).
- **The release zip now ships `.env.example`**, so a fresh install can bootstrap
  its `.env` (#114).
- **Every admin button now has a pointer cursor, a hover state, and a visible
  focus ring** (#236).

## [0.4.1] - 2026-08-08

**Update to this release, not 0.4.0.** v0.4.0 could not be installed by the
self-updater at all, and a site that got past the point where it aborted would
have served `ViteException` on nearly every page. Both causes are fixed here,
and both now have guards. No application behaviour changed otherwise — 0.4.1 is
0.4.0 plus these two fixes.

If a 0.4.0 update already failed on your site, it stopped at
`composer.json and composer.lock are out of sync after extraction` and rolled
back; the recovery is in the second entry below.

### Fixed

- **The release now ships a `composer.lock` that matches its `composer.json`.**
  Composer includes the `version` field in the lock's `content-hash`, so bumping
  `composer.json` to `0.4.0` *after* running `composer update` left the lock
  hashed against `0.3.3`. cms-framework's `verifyComposerFilesInSync()`
  pre-flight — which exists for exactly this — refused the update and aborted
  before touching the site. On 0.4.0 the rollback then failed too, leaving the
  install at "Manual intervention required" with `vendor/` still on the old
  release and `nwidart/laravel-modules` absent, which surfaced as
  `Class "Nwidart\Modules\Providers\ConsoleServiceProvider" not found` and, once
  the exception handler could not resolve `view` to render it,
  `Target class [view] does not exist`.

  Recovering a site stranded by 0.4.0 does not need a reinstall: restore a
  `composer.lock` matching the on-disk `composer.json`, delete the stale
  `bootstrap/cache/services.php` and `packages.php` (they still list
  pre-refactor providers), and run
  `composer install --no-dev --optimize-autoloader`.

  `Modules/Updater/tests/Feature/ReleaseIntegrityTest.php` now recomputes
  composer's content hash and fails the build when the two files drift, and
  pins the `composer.json` ↔ `config/app.php` version lockstep alongside it.

- **Pages resolve to the right Vite entry on a site updated in place.** The
  self-updater overlays a release without deleting what the release removed, so
  every page 0.4.0 moved into a module left its pre-move copy behind under
  `resources/js/pages`. `InertiaPageEntry::resolve()` picked candidates by
  page-path order, so it kept choosing that orphan — which the release's
  manifest does not contain, because the release was built from a tree that no
  longer has it. The result was `Unable to locate file in Vite manifest:
  resources/js/pages/…` on essentially the whole admin, since 0.4.0 moved nearly
  every page.

  Resolution now consults the built manifest and returns the candidate the
  release actually shipped, falling back to page-path order when there is no
  manifest (`npm run dev`, where the dev server serves by path and a checkout
  has no orphans). This is invisible in development, which is why nothing caught
  it: a dev checkout has exactly one copy of every page.
  `tests/Feature/InertiaPageEntryOverlayTest.php` reproduces the two-copies
  state that `ModularSetupTest` correctly forbids in the repo.

## [0.4.0] - 2026-08-08

> **Withdrawn — do not install.** This release shipped a `composer.lock` out of
> sync with its `composer.json`, so the self-updater aborts before applying it.
> Everything below is real and ships in **0.4.1**; install that instead.

Keystone is modular. The application code that had accumulated in a single
`app/` tree now lives in sixteen `nwidart/laravel-modules` modules, each owning
its own controllers, models, routes, migrations, React pages and tests. This is
an internal restructure and nothing else: **no route name changed, no Inertia
page key changed, no migration was renamed, and there are no new migrations at
all.** An in-place update from 0.3.3 is drop-in — the schema is untouched and
every URL, redirect and generated Wayfinder helper resolves exactly as before.
Four smaller fixes ride along.

### Changed

- **Sixteen modules extracted from the monolithic `app/` (#201–#218).**
  Analytics, Auth, Blog, ContentModel, Forms, Installer, Media, Pages,
  Performance, Plugins, Privacy, Seo, SiteEditor, Themes, Updater and Users each
  became a `Modules/<Name>/` package under the `Modules\<Name>\` namespace, with
  its PHP, its `routes/{web,admin,api}.php`, its migrations and factories, its
  `resources/js/pages` and its `tests/{Feature,Unit}` colocated. What stays in
  `app/` now earns its place there — cross-cutting middleware, the hook and
  admin-menu support layer, and the shared editor scaffolding — and the handful
  of core files that legitimately name a module class are enumerated in
  `CLAUDE.md` so a new one is a deliberate addition rather than drift.

  The compatibility guarantees are enforced, not asserted:
  `tests/Feature/ModularSetupTest.php` fails the build if a route name in
  `plans/route-baseline.json` stops being registered (or a live name is missing
  from it), if two page roots claim one Inertia page key, or if the four places
  that must agree on where module pages live — `config/inertia.php`,
  `App\Support\InertiaPageEntry`, and the `import.meta.glob` calls in
  `resources/js/app.tsx` and `resources/js/ssr.tsx` — fall out of step.
  Migrations moved without being renamed, because Laravel's migrator keys the
  `migrations` table on filename.

- **Every module provider extends `App\Providers\KeystoneModuleServiceProvider`
  rather than nwidart's.** nwidart registers `Modules/<Name>/resources/views` as
  a view path whether or not the module ships one, and `php artisan view:cache`
  throws `DirectoryNotFoundException` on the first missing directory — which
  would break Blade caching app-wide, and the installer's cache step with it.
  Keystone's modules deliberately ship no Blade, so the base class registers
  only the paths that exist. Module scaffolding is tuned to match in
  `config/modules.php`: no views, no per-module asset pipeline, no per-module
  `vite.config.js` or `package.json`. Module JS is built by the root Vite config.

- **The `/admin/settings` panel collection is now a hooks filter (#235).**
  `KeystoneShellController::settings()` used to call a module controller per
  settings tab, which meant every new module-owned panel edited core. Core now
  emits `keystone.admin.settings.panels` via the new `App\Support\SettingsPanels`
  and the Privacy and Performance modules each claim their own tab from their own
  service provider. Registration is idempotent, core-supplied keys win, and the
  frontend null-guards a panel whose module is absent.

- **The Auth pages call Wayfinder actions instead of hardcoded paths (#225).**
  Register, ForgotPassword, ResetPassword, ConfirmPassword and VerifyEmail now
  import their endpoints from `@/actions`, so an auth controller that moves can
  no longer leave a working-looking form posting to a dead URL — the failure mode
  the module extraction made most likely. `AuthPageRouteReferencesTest` pins the
  resolved URLs.

- **Removed the dead `blog/Show` Inertia page (#227).** `blog.show` renders
  through the active theme's Blade template, not Inertia; the page component had
  no live reference and could only mislead.

- **Refreshed the dependency lock.** Notably `league/commonmark` 2.8.3 → 2.9.0,
  which closes six advisories including four high-severity denial-of-service
  issues (CVE-2026-71488, CVE-2026-71478) in a runtime dependency, and
  `artisanpack-ui/visual-editor` 1.5.5 → 1.6.0, which registers two additional
  package routes (`visual-editor.api.resources.applied-template.show` and
  `visual-editor-renderer-blade.asset`) now recorded in the route baseline.
  `composer audit` reports no remaining advisories.

### Fixed

- **The edit screens rebase the whole form from the save response (#232).**
  After a save the post and page editors adopted only the server-owned trio —
  status, publish date, slug — from the persisted record and kept everything else
  from the submitted snapshot. Any field a plugin rewrote on
  `keystone.admin.edit.form.beforeSubmit` therefore kept displaying its
  *pre-filter* value and was marked clean, so nothing prompted a reload and the
  next save wrote the stale value back over the filtered one. The new
  `rebaseEditForm()` helper adopts every field the response returns, but only
  where the user hasn't touched it since the request left — comparing against a
  request-start snapshot rather than against the saved record, so an edit made
  while the save was in flight isn't silently discarded. Covered by a browser
  test.
- **Private posts and pages are handled on the index screens (#233).** The
  `private` status is reachable without the status dropdown — the visual editor,
  an import or a plugin can persist it — but the index screens' status union
  omitted it, so a private record rendered an undefined tone on a row no tab
  could filter to, and the status dropdown offered no way to change it back. Both
  screens now key their tone map and tab set off a shared `ContentRowStatus`
  union that mirrors the framework enum, `Private` is offered in the status
  dropdown, and the private ↔ published round-trip is covered by feature tests.
  `PublicVisibility` already kept those records off the public site.
- **A missing visual-editor dist tree is now diagnosable instead of a bare 404
  (#157).** `artisanpack-ui/visual-editor` 1.5.0–1.5.2 gitignored `dist/` and
  their release workflow discarded it, so a Composer install of those versions
  landed a vendor tree with no `dist/editor/` and every site-editor asset request
  404'd with nothing to explain why — which took a release cycle to trace back to
  the package version. 1.5.3 is the first release that ships the prebuilt bundle.
  `VisualEditorAssetController` now logs the actionable cause when the tree is
  absent, and `Modules/SiteEditor/tests/Feature/VisualEditorAssetTest.php` pins
  both the version floor and the vendored tree so a downgrade fails the suite
  with a readable reason.
- **Status pill colours agree between the content indexes and the editor.** The
  post/page index and the editor's Publish panel mapped `scheduled` and `private`
  to opposite hues, so a record appeared to change state on the way into its
  editor.

## [0.3.3] - 2026-08-02

Block themes render. A theme that ships `templates/*.html` + `parts/*.html`
and no Blade — the shape the site editor is built around — took every public
route down with `View [index] not found`, and once that was fixed still
rendered its templates without any of their text. Both halves are closed here,
the second by way of two upstream releases.

### Fixed

- **Public routes no longer 500 on a theme that ships no Blade templates.**
  `ThemeManager::resolveTemplate()` only ever looks for root-level
  `*.blade.php` in the active theme and hard-falls-back to the *name* `index`
  when it finds none. A block theme — `templates/*.html` + `parts/*.html` and
  no Blade, the shape the site editor is built around — therefore resolved to a
  view nothing on disk provides, and every theme-rendered route died with
  `View [index] not found`. Reported against `/preview/{type}/{id}`, but
  `/blog/{slug}` and the public page catch-all failed identically; `/blog`
  only survived because it is Inertia-rendered. New `ThemeTemplateLocator`
  owns both halves of resolution: `viewFor()` returns the theme's own Blade
  template when it ships one and the new `block-theme` layout when it doesn't,
  and `blocksFor()` walks the *same* WP-style hierarchy against the
  site-editor store. Blade themes are unaffected.
- **A post's `single-post` template is consulted again.** Post rendering asked
  the site-editor store for the single hardcoded slug `single`, so a theme's
  `single-post` template was skipped even though the Blade side honoured
  `single-post.blade.php` — the two hierarchies were out of step. `single`
  stays in the chain, so installs that authored one keep resolving it. Pages
  now receive `templateBlocks` as well, matching posts.

### Changed

- **Raised the `artisanpack-ui/cms-framework` floor to ^2.7.2 and
  `artisanpack-ui/visual-editor` to ^1.5.5.** Below those versions a theme
  file's markup never reaches the renderer in a usable form: cms-framework left
  `ResolvedEntity::$blocks` empty for `.html` sources
  ([cms-framework#274](https://github.com/ArtisanPack-UI/cms-framework/issues/274)),
  and nothing could convert WP-serialized markup — which carries block text in
  the inner HTML — into the editor-shape tree the Blade renderer consumes, which
  reads `attributes.content`
  ([visual-editor#688](https://github.com/ArtisanPack-UI/visual-editor/issues/688)).
  Together they made a block theme render structurally correct but entirely
  textless. 2.7.2 parses theme files on resolve via `ThemeFileBlockParser`,
  delegating attribute recovery to 1.5.5's `BlockMarkupHydrator`, so a block
  theme's templates and parts now render without first being opened and saved
  in the site editor.

## [0.3.2] - 2026-08-01

### Added

- **"Check for updates" button on Settings → System → Updates.** The release
  data on that page is served from `UpdateChecker`'s cache, which holds for
  `cms.updates.cache_ttl` (12h by default), so a release published since the
  last check stayed invisible until the TTL lapsed — and the only way to force
  a fresh read was `php artisan update:check --clear-cache` over SSH. The
  button drops the cached answer and redirects back into the page, so the new
  release travels the same classification path as any other visit. Rate-limited
  to 6/min, matching `plugins/check-updates`, because each hit forces a
  synchronous GitLab round-trip. It sits outside the
  `keystone.admin.settings.updates.actions` filter so a plugin replacing the
  action row can't remove the operator's only in-admin way to refresh the feed.

### Fixed

- **Keystone now keeps `composer.lock` in the update payload regardless of the
  installed framework version.** cms-framework ≤ 2.7.0 shipped `composer.lock`
  in the `cms.updates.exclude_from_update` default, annotated "Rebuilt via
  composer install" — which it is not; `composer install` only ever *reads* the
  lock. On those versions an update replaced `composer.json` with the release's
  copy while leaving the site's old lock in place, and the updater's
  `composer install` then aborted on the constraint mismatch. 2.7.1 fixed the
  framework default, so on a current install `UpdatesServiceProvider`'s
  override is a no-op; it stays because the lock and `composer.json` are a
  matched pair and Keystone shouldn't depend on which framework version a site
  happens to be running to get that right.

## [0.3.1] - 2026-08-01

### Changed

- **Updated `artisanpack-ui/cms-framework` to 2.7.1**, which continues the fixes
  to the self-update process. The updater now refuses non-`https` release
  archives (`cms.updates.allow_insecure_transport`), checks that
  `composer.lock` is in sync with `composer.json` before invoking composer so a
  divergence is reported with its real cause, persists a step marker that the
  new `php artisan update:status` command reports on, and lifts maintenance
  mode when an update dies mid-flight. Downgrades and rollbacks to externally
  provenanced archives now require explicit opt-in
  (`update:perform --allow-downgrade`, `update:rollback --allow-external`).

### Fixed

- **Custom fields can no longer write a model's protected attributes.** Via the
  framework update, `applyCustomFieldValues()` is now an allowlist keyed to
  fields registered for the content type, closing case-variant, JSON-path, and
  unregistered-key bypasses; creating a custom field whose key collides with an
  existing column or a reserved key is rejected outright. The framework update
  also resolves an N+1 query on unknown attribute access and stops a cleared
  column-storage field from resurrecting its default value.

## [0.3.0] - 2026-07-31

### Added

- **Keystone extension surface — a first-class PHP + JS hook system (#125–#156).**
  Actions and filters now span the admin (menus, users, settings, plugins,
  themes, updater, content types), auth, comments, caching, SEO, the installer,
  plugin/theme boot, and public rendering. Blade templates gain hook directives,
  and the front end exposes a matching JS hook registry wired through
  `resources/js/ssr.tsx` and the Vite build. Documented in `docs/hooks.md`.
- **Redesigned post/page/CPT editor.** The edit screen is now a panel-based
  layout with drag-to-reorder panels, a Screen Options menu, and per-user
  persistence of panel order and visibility (`UserEditorPreference`, backed by
  the new `user_editor_preferences` table and `EditorPreferenceController`).
  Ships Publish, Categories, Tags, Excerpt, Featured Image, and Attributes
  panels, plus a reusable slug field with live permalink preview.
- **Draft previews.** `PreviewController` and `PreviewUrl` generate signed
  preview URLs so unpublished content can be viewed without publishing it.
- **Scheduled publishing.** The `PublishScheduledContent` console command
  promotes scheduled posts, pages, and custom content types once their
  publish date passes.
- **Add Content modal** for creating content directly from the index screens.
- Custom content types can now declare their own database tables via
  `ContentTypeTables` and the `keystone_content_type_tables` table.

### Changed

- **Admin color system rebuilt on a neutral slate base with a WCAG-clamped
  brand palette.** Brand colors supplied by a site are now clamped to meet
  contrast requirements before they reach the admin UI, so custom branding can
  no longer produce unreadable text.
- Bumped `artisanpack-ui/cms-framework` from `^2.5.3` to `^2.7.0`.

### Fixed

- Resolved all 39 code-review findings raised against the Editor 1.1–1.11 work,
  covering the post, page, and dynamic-content edit and index screens, admin and
  web routing, and media attachment handling.
- Image uploads are now validated through a shared `ImageMediaRule`.
- Public visibility of content is centralized in `PublicVisibility`, keeping
  the blog, public pages, and permalink handling consistent.

## [0.2.5] - 2026-07-27

### Changed

- Bumped `artisanpack-ui/visual-editor` from `1.5.1` to `1.5.3`, picking up
  the site-editor render fixes that unblocked the 0.2.5 release attempt.
- Bumped `artisanpack-ui/cms-framework` from `2.5.3` to `2.5.4`. Updater
  metadata GETs (release feeds, single-release lookups, SHA-256 sidecars,
  custom JSON) now go through a raw Guzzle client that bypasses Laravel's
  HTTP factory event dispatch, so listeners like Herd Pro's
  `HttpClientWatcher`, Telescope, and Debugbar can no longer wedge or
  corrupt an update check. The download-body invariant added in 2.5.1
  (#124, cms-framework#214) is now extended to every metadata request.
- **Updater is now checksum-strict by default.** cms-framework 2.5.4
  refuses to install any update whose source does not advertise a
  SHA-256, instead of the previous warn-and-skip. Opt back in on trusted
  networks with `cms.updates.allow_unverified_updates=true`. Every
  release built by this project already publishes a `.sha256` sidecar,
  so no operator action is required for hosted Keystone updates.
- Picked up transitive updates from `composer update`:
  `laravel/framework` (13.22.0 → 13.23.0),
  `aws/aws-sdk-php` (3.389.0 → 3.389.1),
  and a `dedoc/scramble` dev bump (v0.13.35 → v0.13.36).

### Fixed

- `UpdaterIntegrationTest` now uses `MetadataClient::useHttpFacadeBridge()`
  in `beforeEach` (with a matching `reset()` in `afterEach`) so
  `Http::fake()` continues to intercept updater metadata GETs after the
  cms-framework 2.5.4 raw-Guzzle switch. Also added coverage for the
  new "no advertised SHA-256, opt-in required" behavior alongside the
  existing warn-and-skip case.

## [0.2.4] - 2026-07-26

### Changed

- Bumped `artisanpack-ui/visual-editor` from `1.5.0` to `1.5.1`.
- Picked up transitive updates from `composer update`:
  `laravel/framework` (13.21.1 → 13.22.0),
  `aws/aws-sdk-php` (3.388.11 → 3.389.0),
  `guzzlehttp/guzzle` (7.15.1 → 7.15.2),
  and dev-only bumps to `amphp/amp` and `amphp/pipeline`.

## [0.2.3] - 2026-07-22

### Fixed

- Self-updater now completes cleanly under Laravel Herd Pro, Telescope,
  Debugbar, and any other `Illuminate\Http\Client\Events\ResponseReceived`
  listener. The framework's `Http::sink()` download response used to leave
  its body as a detached `LazyOpenStream`; any listener calling
  `$response->body()` on it (Herd's HTTP watcher does this on every
  response) threw `Stream is detached` after the pipeline had already
  finished, triggering a rollback of a successfully-applied update.
  (cms-framework #224)
- Self-updater now discovers `composer` and `php` on hosts where PHP-FPM's
  `PATH` doesn't include them (Herd, most stock Nginx setups). Previously
  the update failed with `sh: composer: command not found` or
  `env: php: No such file or directory`, and rollback masked the real
  error as "Manual intervention required." Framework now auto-discovers
  common binary locations, respects a `COMPOSER_BINARY` env override, and
  surfaces a specific `composerBinaryNotFound` exception with the
  workaround instead of a misleading rollback message.
  (cms-framework #225)
- Updates admin page no longer shows a stale "Update available"
  banner for the same version already installed. Previously, the
  framework cached the `UpdateInfo` value object (including a
  `currentVersion` snapshot) for 12 hours; any out-of-band version bump
  (manual composer install, unzip-over-site, deploy script) left the
  cached snapshot lying about `hasUpdate()` until TTL expired.
  `UpdateInfo::hasUpdate()` now reads `config('app.version')` fresh at
  call time, and the checker evicts the cached entry when its snapshot
  drifts from the installed version. (cms-framework #226)
- Admin notifications poller no longer throws a `TypeError` every ~30
  seconds. Framework's `NotificationController::index` was passing the
  raw `?limit=` string straight to `NotificationManager::getUserNotifications(int $limit, ...)`,
  flooding `storage/logs/laravel.log` with dozens of exceptions per
  minute on every admin session. Framework now coerces the query param
  to int at the controller boundary. Landed in cms-framework 2.5.2 but
  Keystone 0.2.2's lockfile pinned 2.5.1; this release picks it up.
  (cms-framework #220)

### Changed

- Bumped `artisanpack-ui/cms-framework` constraint from `^2.5.1` to
  `^2.5.3`.

## [0.2.2] - 2026-07-22

### Fixed

- Self-updater no longer 503s the host when the release archive triggers a
  PHP memory-limit fatal during download. Pulls in the upstream cms-framework
  2.5.1 fix, which streams the update zip to disk and widens the framework's
  own catch to `\Throwable` so rollback + `php artisan up` still run on any
  fatal. Keystone's `UpdatesController` already caught `\Throwable`, so the
  release also adds two Pest tripwire tests that lock that guarantee in as a
  regression guard. (#124, cms-framework#214)

## [0.2.1] - 2026-07-22

### Added

- Admin-scoped loading progress bar. Fires within one animation frame for every
  Inertia navigation, form submission, and user-triggered admin fetch
  (notifications, settings save, notification preferences). Follows the site's
  configured brand primary color and stays hidden on the public site. (#123)

### Fixed

- Safari greyed out the `.zip` option in the plugin/theme install file picker
  on first open. (#122)
- Install wizard now persists selected options across page reloads, gates the
  admin menu until installation is complete, and no longer flashes placeholder
  rows in admin list screens before real content loads. (#118, #119, #120, #121)
- Media library uploads failed silently because the `MediaStoreRequest`
  form-request subclass was missing. (#117)

### Changed

- Bumped Composer and npm dependencies to their latest in-range versions.
- Plugin test fixtures moved from `tests/fixtures` into
  `storage/framework/testing` so they no longer ship in the release archive.

## [0.2.0] - 2026-07-19

Initial 0.2 line: Module Federation plugin host, Content Model admin with
dynamic content types, plugin admin, Privacy + Performance integrations,
web install wizard, updater wired to GitLab tarball releases, and the first
Pest browser-suite coverage for the admin shell.

## [0.1.0]

First tagged release of the Keystone CMS baseline.
