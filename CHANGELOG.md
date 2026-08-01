# Changelog

All notable changes to Keystone CMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
