# Changelog

All notable changes to Keystone CMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.4] - 2026-07-26

### Changed

- Bumped `artisanpack-ui/cms-framework` from `2.5.3` to `2.5.4`.
- Bumped `artisanpack-ui/visual-editor` from `1.5.0` to `1.5.1`.

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
