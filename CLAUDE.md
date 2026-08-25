<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application running on PHP 8.4. You are an expert with the Laravel ecosystem. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists (settled decisions, non-obvious traps, standing constraints). Framework and package guidelines that only apply to specific paths (testing, frontend, components) also live there, under `.ai/rules/boost` — this is not just recorded decisions, it is load-bearing guidance you have not seen inline. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.
- Record durable rules with `record-rule` so the next agent or teammate inherits them instead of working them out again. Pass a `glob` (e.g. `app/Http/Controllers/**`), a short `title`, and a few-line `note`. Always use `record-rule`, never your native memory or notes tool — native memory is personal and session-scoped; only `.ai/rules` is shared with the team and persists in the repo.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== herd rules ===

# Laravel Herd

- The application is served by Laravel Herd at `https?://[kebab-case-project-dir].test`. Use the `get-absolute-url` tool to generate valid URLs. Never run commands to serve the site. It is always available.
- Use the `herd` CLI to manage services, PHP versions, and sites (e.g. `herd sites`, `herd services:start <service>`, `herd php:list`). Run `herd list` to discover all available commands.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-react-development` when working with Inertia client-side patterns.

# Inertia v3

- Use all Inertia features from v1, v2, and v3. Check the documentation before making changes to ensure the correct approach.
- New v3 features: standalone HTTP requests (`useHttp` hook), optimistic updates with automatic rollback, layout props (`useLayoutProps` hook), instant visits, simplified SSR via `@inertiajs/vite` plugin, custom exception handling for error pages.
- Carried over from v2: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.
- Axios has been removed. Use the built-in XHR client with interceptors, or install Axios separately if needed.
- `Inertia::lazy()` / `LazyProp` has been removed. Use `Inertia::optional()` instead.
- Prop types (`Inertia::optional()`, `Inertia::defer()`, `Inertia::merge()`) work inside nested arrays with dot-notation paths.
- SSR works automatically in Vite dev mode with `@inertiajs/vite` - no separate Node.js server needed during development.
- Event renames: `invalid` is now `httpException`, `exception` is now `networkError`.
- `router.cancel()` replaced by `router.cancelAll()`.
- The `future` configuration namespace has been removed - all v2 future options are now always enabled.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== wayfinder/core rules ===

# Laravel Wayfinder

Use Wayfinder to generate TypeScript functions for Laravel routes. Import from `@/actions/` (controllers) or `@/routes/` (named routes).

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

## Pest

- This project uses Pest for testing. Create tests: `php artisan make:test --pest {name}`.
- The `{name}` argument should not include the test suite directory. Use `php artisan make:test --pest SomeFeatureTest` instead of `php artisan make:test --pest Feature/SomeFeatureTest`.
- Run tests: `php artisan test --compact` or filter: `php artisan test --compact --filter=testName`.
- Do NOT delete tests without approval.

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.

</laravel-boost-guidelines>

---

# Modules

Keystone is a modular Laravel app built on `nwidart/laravel-modules` v13. The
migration off the monolithic `app/` layout is complete: sixteen modules live
under `Modules/` — Analytics, Auth, Blog, ContentModel, Forms, Installer, Media,
Pages, Performance, Plugins, Privacy, Seo, SiteEditor, Themes, Updater, Users —
and `app/` holds only cross-cutting code (see **What stays in core** below).
`plans/14-modular-laravel-setup.md` records the target architecture, the
per-module inventory and the migration history. **Read §7 (the per-module
playbook) before moving anything into or between modules.**

## Layout

nwidart's default layout, one directory per domain:

```text
Modules/<Name>/
  app/{Http/Controllers,Http/Requests,Models,Policies,Providers,Services,Support}
  config/                 ← only if the module owns config
  database/{migrations,factories,seeders}
  resources/js/{pages,components}
  routes/{web,admin,api}.php
  tests/{Feature,Unit}
  composer.json           ← autoload only; merged into the root by composer-merge-plugin
  module.json
```

Namespace is `Modules\<Name>\` (mapped to `app/`). Create modules with
`php artisan module:make <Name> --no-interaction`, then `composer dump-autoload`,
then repoint the generated provider at `App\Providers\KeystoneModuleServiceProvider`
instead of nwidart's `ModuleServiceProvider` (see **What stays in core**).
Generation is tuned lean in `config/modules.php`: no Blade views, no
`resources/assets`, no per-module `vite.config.js` or `package.json`, no config
directory. Delete anything else the module doesn't need before committing.

`artisanpack:optional-packages-command` does **not** scaffold this structure —
that branch was removed once the real modules landed. Modules are created by
hand with `module:make`.

## What stays in core

`app/` is not "the stuff nobody got around to moving." A class earns its place
there by being consumed by core plus more than one module, or by being an
app-wide policy a module only has a clause in. The current inventory, audited at
the close of the migration:

- **Providers** — `AppServiceProvider` (five registrations, each with a PHPDoc
  saying why it can't live in a module), `SettingsServiceProvider` (the settings
  schema is deliberately central; splitting it per module is a possible
  follow-up, not a decision), and `KeystoneModuleServiceProvider`, the base
  class **every** module provider extends instead of nwidart's. It exists
  because nwidart registers `Modules/<Name>/resources/views` whether or not the
  module has one, and `view:cache` throws on the first missing view path —
  breaking Blade caching app-wide and the installer's cache step with it.
- **HTTP** — `HandleInertiaRequests`, `EnsureFeatureIsEnabled`,
  `EnsureSiteIsAccessible` + `SitePasswordController`, `EnsureTwoFactorEnrollment`
  (aliased in `bootstrap/app.php`, applied by nearly every module's route
  provider), `PreviewController`, `NotificationPreferenceController`, the
  `KeystoneShellController` commerce placeholders, and the
  `HandlesPublication` / `NormalizesUsername` concerns (Blog + Pages, and
  Auth + Users, respectively).
- **Support** — `Hooks`, `HookAliases`, `AdminMenu/`, `AdminTheme`,
  `DateFormatter`, `EnvWriter`, `DeferredConfigCacheRebuild`,
  `PermalinkStructure`, `PreviewUrl`, `SiteBranding`, `InertiaPageEntry`,
  `NotificationItemPayload`, `SettingsPanels` (the `/admin/settings`
  panel-collection filter — core owns the emit, modules own their payloads),
  `Content/PublicVisibility` and `ContentEdit/*`.
  The `ContentEdit` group pairs with the shared editor components in
  `resources/js/components/admin/editor/**` — in particular `EditorPanels` is
  the server mirror of `editor/panels/registry.ts`, so it stays central even
  though Users is its only PHP caller.
- **Console** — `WayfinderSanitizePaths`, `OptionalPackagesCommand`.

### Core → module references

`app/` naming a `Modules/` class is the reverse of the usual direction. It is
not rare, and pretending otherwise would be misleading — seven core files do it
(`grep -rlE '^use Modules\\' app/`). The full list, so a new one is a deliberate
addition rather than a drift:

| Core file | Module class | Why |
|---|---|---|
| `Providers/AppServiceProvider` | `Users\Models\User`, `ContentModel\Models\DynamicContentEditorModel` | Type hint + `instanceof` in the `Gate::before` bypass |
| `Http/Middleware/HandleInertiaRequests` | `Users\Models\User`, `Users\...\PermissionSlugResolver`, `Installer\Support\KeystoneSampleData`, `Plugins\Support\FederatedModuleManifest` | Shared Inertia props |
| `Support/AdminMenu/AdminMenuBuilder` | `Users\Models\User`, `Users\...\PermissionSlugResolver`, `ContentModel\Support\SpecializedContentTypes` | Menu gating |
| `Http/Controllers/Admin/KeystoneShellController` | `Installer\Support\KeystoneSampleData` | Commerce placeholders |
| `Http/Controllers/PreviewController` | `Blog\...\BlogController`, `Pages\...\PublicPageController` | Constructor injection to re-render in preview mode |
| `Support/NotificationItemPayload` | `Users\Models\User` | Type hint |
| `Http/Controllers/Admin/NotificationPreferenceController` | `Users\Models\User` | Type hint |

Most are `User` — unavoidable while the model lives in Users, and not worth
undoing. The one that was flagged as *accumulating* — `settings()` calling a
module controller per settings panel — is gone: core emits
`keystone.admin.settings.panels` and Privacy and Performance each claim their
own tab from their own provider (**#235**, see `App\Support\SettingsPanels`).
`KeystoneSampleData` disappears when the commerce placeholders become real.

The table is scoped to `app/`. One file outside it does the same and is
legitimate: `bootstrap/app.php` imports `Modules\Installer\...\Installed` and
`Modules\Privacy\...\InjectPrivacyBanner` because middleware aliases and the
global stack are registered centrally — a module provider has no seat at
`withMiddleware()`. Any *other* root-level file reaching into `Modules\` is
drift.

Every entry is documented at its call site. Before adding a row, check whether
the module could register itself with core instead — that is the direction the
hooks system exists for. Note that registering a settings panel via
`keystone.admin.settings.panels` is only half the job: `presentTabs` in
`resources/js/pages/admin/Settings.tsx` switches on the `privacy` and
`performance` keys by name, so a third module-contributed panel needs a
matching case there.

## Hard invariants

These two are what make an extraction reviewable, and both have guards:

- **Route names never change.** A module move may change a route's `action` and
  nothing else. Module `RouteServiceProvider`s must reapply the exact middleware,
  prefix, and name prefix the central route file used. `ModularSetupTest` fails
  the build if a baseline route name stops being registered, *or* if a registered
  name is missing from the baseline — so re-capture it with
  `php artisan route:list --json | jq 'sort_by(.name)' > plans/route-baseline.json`
  and commit it with the MR whenever routes move.
- **Inertia page keys never change.** `Inertia::render('admin/posts/index')` keeps
  working because `resources/js/lib/resolve-page.ts` flattens
  `resources/js/pages/**` and `Modules/*/resources/js/pages/**` into one map keyed
  relative to each `pages/` root. Two roots claiming one key fails
  `ModularSetupTest`; at runtime it throws under `npm run dev` and, in production,
  shadows the module page rather than taking the site down. Module page dirs are
  lowercase.

  Three places must agree on where pages live, and only the first is obvious:
  `resolve-page.ts` (client resolution), `config/inertia.php` `page_paths`
  (server-side existence check, which `assertInertia()->component()` uses), and
  `App\Support\InertiaPageEntry` (the per-page `@vite()` entry in
  `app.blade.php`, which is a Vite *manifest key*). The last two glob the module
  roots in, so a module MR touches none of them — but note that a mistake in
  either is **invisible under `npm run dev`**, because `public/hot` makes
  Laravel bypass the manifest entirely. Verify module moves with the dev server
  stopped, or trust `ModularSetupTest`, which pins all three build-independently.

## Conventions

- Module JS is colocated but built by the **root** Vite config — never add a
  per-module bundler config. `npm run build:ssr` must pass in every module MR;
  `ssr.tsx` is the entry people forget.
- Shared UI (layouts, `components/admin/editor/**`, `components/admin/custom-fields/**`,
  `lib/`, Wayfinder output) stays in `resources/js/`. Cross-module imports use
  `@modules/<Name>/resources/js/...` and should be rare.
- Migrations move **without being renamed** — the `migrations` table matches on
  filename. Models moved into a module need a `newFactory()` override.
- Module `composer.json` files declare autoload only. A new dependency goes in the
  root `composer.json` + lock, or it won't exist on a deployed site
  (`composer install` replays the lock and never sees merged requirements).
  Add an `autoload-dev` PSR-4 map for `Modules\<Name>\Tests\` **only** when the
  module's tests ship classes that need autoloading — fixtures, fakes, base
  cases. Pest test *files* are globbed by `phpunit.xml` and need no map, which is
  why SiteEditor (three widget fixtures) is currently the only module with one.
- Runtime feature toggling stays with `config/keystone.php` `features` +
  `EnsureFeatureIsEnabled`. All nwidart modules are always enabled —
  `modules_statuses.json` is committed with everything `true`. Do not build a
  second toggle system.
- Moving a controller changes its Wayfinder action path. Re-run
  `php artisan wayfinder:generate --no-interaction` and fix every TSX import that
  pointed at it; `npm run build` catches the misses.
- Tests move with their module into `Modules/<Name>/tests/{Feature,Unit}`.
  `phpunit.xml` and `tests/Pest.php` already glob those paths — no per-module
  registration needed. Browser tests stay in `tests/Browser`.
