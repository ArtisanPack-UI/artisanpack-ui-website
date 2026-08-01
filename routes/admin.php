<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\ContentModel\ContentTypeContentController;
use App\Http\Controllers\Admin\ContentModel\ContentTypeController;
use App\Http\Controllers\Admin\ContentModel\CustomFieldController;
use App\Http\Controllers\Admin\ContentModel\TaxonomyController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EditorPreferenceController;
use App\Http\Controllers\Admin\FormController;
use App\Http\Controllers\Admin\KeystoneShellController;
use App\Http\Controllers\Admin\MediaController;
use App\Http\Controllers\Admin\NotificationPreferenceController;
use App\Http\Controllers\Admin\PageController;
use App\Http\Controllers\Admin\PerformanceAdminController;
use App\Http\Controllers\Admin\PermissionController;
use App\Http\Controllers\Admin\PluginController;
use App\Http\Controllers\Admin\PostCategoryController;
use App\Http\Controllers\Admin\PostController;
use App\Http\Controllers\Admin\PostTagController;
use App\Http\Controllers\Admin\PrivacyAdminController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SeoRedirectController;
use App\Http\Controllers\Admin\Settings\PerformanceController as SettingsPerformanceController;
use App\Http\Controllers\Admin\Settings\PrivacyController as SettingsPrivacyController;
use App\Http\Controllers\Admin\Settings\UpdatesController as SettingsUpdatesController;
use App\Http\Controllers\Admin\SiteDesign\BusinessInfoController;
use App\Http\Controllers\Admin\SiteEditorController;
use App\Http\Controllers\Admin\ThemeController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Settings\AppearanceController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\TwoFactorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
|
| Routes that drive the Keystone admin shell. Every route in this file is
| gated by `auth` and either `role:` or `permission:` per the matrix in
| `plans/06-keystone-plan.md` §3.6.
|
| Sample-data pages (issue #11) live under `KeystoneShellController`; once
| their backing models land, each graduates into its own resource
| controller. User/role/permission management lives at `/admin/users`,
| `/admin/roles`, `/admin/permissions`.
|
*/

Route::middleware(['auth', 'verified', 'two-factor', 'two-factor.enroll'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function (): void {
        Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

        // Dashboard CRUD + management. Literal-path routes (`manage`,
        // `reorder`) are declared before the `{slug}` wildcards so the
        // wildcard doesn't capture them as a dashboard slug.
        Route::get('dashboards', [DashboardController::class, 'dashboardsIndex'])->name('dashboards.index');
        Route::get('dashboards/manage', [DashboardController::class, 'manage'])->name('dashboards.manage');
        Route::post('dashboards', [DashboardController::class, 'store'])->name('dashboards.store');
        Route::patch('dashboards/reorder', [DashboardController::class, 'reorder'])->name('dashboards.reorder');
        Route::patch('dashboards/{slug}', [DashboardController::class, 'update'])->name('dashboards.update');
        Route::delete('dashboards/{slug}', [DashboardController::class, 'destroy'])->name('dashboards.destroy');

        Route::get('dashboards/{slug}', [DashboardController::class, 'show'])->name('dashboards.show');
        Route::post('dashboards/{slug}/apply-starter', [DashboardController::class, 'applyStarter'])->name('dashboards.apply-starter');
        Route::post('dashboards/{slug}/widgets', [DashboardController::class, 'storeWidget'])->name('dashboards.widgets.store');
        Route::patch('dashboards/{slug}/widgets/reorder', [DashboardController::class, 'reorderWidgets'])->name('dashboards.widgets.reorder');
        Route::patch('dashboards/{slug}/widgets/{id}/layout', [DashboardController::class, 'updateWidgetLayout'])->name('dashboards.widgets.layout');
        Route::patch('dashboards/{slug}/widgets/{id}', [DashboardController::class, 'updateWidget'])->name('dashboards.widgets.update');
        Route::delete('dashboards/{slug}/widgets/{id}', [DashboardController::class, 'destroyWidget'])->name('dashboards.widgets.destroy');

        Route::middleware('role:admin,site_owner,editor')->group(function (): void {
            // #189 — Screen Options panel visibility. Lives beside the
            // editor screens (rather than under `posts`/`pages`) because
            // preferences are per-user and per-post-type, not per-record.
            Route::put('editor-preferences/{postType}', [EditorPreferenceController::class, 'update'])
                ->name('editor-preferences.update');
            Route::delete('editor-preferences/{postType}', [EditorPreferenceController::class, 'destroy'])
                ->name('editor-preferences.destroy');

            Route::post('pages/{page}/duplicate', [PageController::class, 'duplicate'])->name('pages.duplicate');
            // #184 — Add New modal quick-create endpoint. Declared before
            // the resource so `pages/quick-create` isn't captured as a
            // `{page}` binding on the show/edit/update routes.
            Route::post('pages/quick-create', [PageController::class, 'quickCreate'])->name('pages.quick-create');
            // #185 — Live slug preview for the "auto-derive while draft"
            // slug field. Declared before the resource for the same
            // wildcard-collision reason as `quick-create`.
            //
            // Throttled: the client debounces at 500ms, so a human typing
            // stays far under 60/min, but the endpoint is unauthenticated-
            // adjacent enough (any logged-in editor) and cheap enough to
            // call in a loop that it needs a ceiling of its own.
            Route::post('pages/slug-preview', [PageController::class, 'slugPreview'])
                ->middleware('throttle:60,1')
                ->name('pages.slug-preview');
            Route::resource('pages', PageController::class)->except(['show', 'create']);

            Route::middleware('feature:blog')->group(function (): void {
                Route::post('posts/{post}/duplicate', [PostController::class, 'duplicate'])->name('posts.duplicate');
                Route::post('posts/quick-create', [PostController::class, 'quickCreate'])->name('posts.quick-create');
                // Throttled for the same reason as the pages preview above.
                Route::post('posts/slug-preview', [PostController::class, 'slugPreview'])
                    ->middleware('throttle:60,1')
                    ->name('posts.slug-preview');

                // Taxonomy resources are registered *before* the catch-all
                // `posts` resource so `/admin/posts/categories` and
                // `/admin/posts/tags` do not collide with `posts/{post}/edit`
                // route binding.
                Route::resource('posts/categories', PostCategoryController::class)
                    ->parameters(['categories' => 'category'])
                    ->names('posts.categories')
                    ->except(['show', 'create']);
                Route::resource('posts/tags', PostTagController::class)
                    ->parameters(['tags' => 'tag'])
                    ->names('posts.tags')
                    ->except(['show', 'create']);

                Route::resource('posts', PostController::class)->except(['show', 'create']);
            });
        });

        Route::middleware('role:admin,site_owner,editor')->group(function (): void {
            Route::get('media', [MediaController::class, 'index'])->name('media.index');

            // #106 — Generic content admin routes for any registered content
            // type. `post` and `page` are handled by their bespoke
            // controllers above and rejected inside
            // ContentTypeContentController::resolve() so a match here
            // doesn't accidentally shadow them. The `{contentType}` slug
            // constraint matches the framework's content-type slug regex
            // — lowercase letters/digits with single-hyphen separators —
            // so the router doesn't have to invoke the controller for
            // obviously malformed URLs.
            Route::prefix('content/{contentType}')
                ->name('content.')
                ->where(['contentType' => '[a-z0-9]+(?:-[a-z0-9]+)*'])
                ->group(function (): void {
                    Route::get('/', [ContentTypeContentController::class, 'index'])->name('index');
                    Route::post('quick-create', [ContentTypeContentController::class, 'quickCreate'])->name('quick-create');
                    Route::post('/', [ContentTypeContentController::class, 'store'])->name('store');
                    Route::get('{record}/edit', [ContentTypeContentController::class, 'edit'])
                        ->where('record', '[0-9]+')
                        ->name('edit');
                    Route::put('{record}', [ContentTypeContentController::class, 'update'])
                        ->where('record', '[0-9]+')
                        ->name('update');
                    Route::delete('{record}', [ContentTypeContentController::class, 'destroy'])
                        ->where('record', '[0-9]+')
                        ->name('destroy');
                });
        });

        // #18 — SEO redirects admin. Read/write is restricted to roles
        // with editorial control over the site; the `redirects` table is
        // read on every public web request via the HandleRedirects
        // middleware shipped by the SEO package.
        Route::middleware('role:admin,site_owner,editor')
            ->prefix('seo')
            ->name('seo.')
            ->group(function (): void {
                Route::get('redirects', [SeoRedirectController::class, 'index'])->name('redirects.index');
                Route::post('redirects', [SeoRedirectController::class, 'store'])->name('redirects.store');
                Route::put('redirects/{redirect}', [SeoRedirectController::class, 'update'])->name('redirects.update');
                Route::delete('redirects/{redirect}', [SeoRedirectController::class, 'destroy'])->name('redirects.destroy');
            });

        Route::get('products', [KeystoneShellController::class, 'products'])->name('products');
        Route::get('orders', [KeystoneShellController::class, 'orders'])->name('orders');
        Route::get('customers', [KeystoneShellController::class, 'customers'])->name('customers');
        Route::middleware('feature:forms')
            ->prefix('forms')
            ->name('forms.')
            ->group(function (): void {
                Route::get('/', [FormController::class, 'index'])->name('index');
                Route::post('/', [FormController::class, 'create'])->name('create');
                Route::get('submissions', [FormController::class, 'submissions'])->name('submissions.all');
                // `{form:id}` overrides the model's slug-based route key so
                // admin URLs stay stable when a user renames a form (which
                // regenerates the slug via the package's `creating` hook).
                Route::get('{form:id}/edit', [FormController::class, 'edit'])->name('edit');
                Route::delete('{form:id}', [FormController::class, 'destroy'])->name('destroy');
                Route::get('{form:id}/submissions', [FormController::class, 'submissions'])->name('submissions.index');
                Route::get('{form:id}/submissions/{submission}', [FormController::class, 'submissionShow'])->name('submissions.show');
            });
        Route::get('site-design', [KeystoneShellController::class, 'siteDesign'])->name('site-design');
        Route::get('settings', [KeystoneShellController::class, 'settings'])->name('settings');
        Route::get('integrations', [KeystoneShellController::class, 'integrations'])->name('integrations');
        Route::middleware('feature:analytics')->group(function (): void {
            Route::get('reports', [KeystoneShellController::class, 'reports'])->name('reports');
        });
        Route::get('activity-log', [KeystoneShellController::class, 'activityLog'])->name('activity-log');
        Route::get('notifications/preferences', [NotificationPreferenceController::class, 'index'])->name('notifications.preferences');
        Route::get('notifications', [KeystoneShellController::class, 'notifications'])->name('notifications');

        Route::middleware('role:admin,site_owner')->group(function (): void {
            Route::resource('users', UserController::class)->except(['show']);
        });

        // #96.3 — Top-level Privacy admin nav. Gated behind admin only:
        // the Consent Manager and DSR inbox expose subject data that
        // should not be visible to editors, and Breach Manager can
        // trigger authority notifications.
        Route::middleware('role:admin,site_owner')
            ->prefix('privacy')
            ->name('privacy.')
            ->group(function (): void {
                Route::get('/', [PrivacyAdminController::class, 'consents'])->name('consents');
                Route::get('data-requests', [PrivacyAdminController::class, 'dataRequests'])->name('data-requests');
                Route::get('breaches', [PrivacyAdminController::class, 'breaches'])->name('breaches');
                Route::get('reports', [PrivacyAdminController::class, 'reports'])->name('reports');
            });

        // #98.4 — Top-level Performance admin nav. Read-only surfaces
        // (RUM dashboard, slow query log, index suggestions, cache
        // management) that render around the vendor perf package's
        // JSON API. Gated behind admin/site_owner — the RUM dashboard
        // exposes per-page traffic and the slow query log exposes
        // query text that leaks table/column names, so editors don't
        // need it in their day-to-day view.
        Route::middleware('role:admin,site_owner')
            ->prefix('performance')
            ->name('performance.')
            ->group(function (): void {
                Route::get('/', [PerformanceAdminController::class, 'overview'])->name('overview');
                Route::get('slow-queries', [PerformanceAdminController::class, 'slowQueries'])->name('slow-queries');
                Route::get('index-suggestions', [PerformanceAdminController::class, 'indexSuggestions'])->name('index-suggestions');
                Route::get('cache', [PerformanceAdminController::class, 'cacheManagement'])->name('cache');
            });

        Route::middleware('role:admin')->group(function (): void {
            Route::resource('roles', RoleController::class)->except(['show']);
            Route::get('permissions', [PermissionController::class, 'index'])->name('permissions.index');

            // #21 — Settings > System > Updates. Surfaces the cms-framework
            // Updates module (release feed, "Update now" button) inside the
            // Keystone admin shell. The `permission:updater.run` slug is
            // seeded admin-only by KeystonePermissionsSeeder; the outer
            // `role:admin` group is the belt to that suspenders.
            Route::middleware('permission:updater.run')
                ->prefix('settings')
                ->name('settings.')
                ->group(function (): void {
                    Route::get('updates', [SettingsUpdatesController::class, 'show'])->name('updates');
                    Route::post('updates', [SettingsUpdatesController::class, 'update'])->name('updates.run');
                });

            // #96.2 — Settings > Privacy. The panel itself is rendered
            // inline inside the main `admin/Settings` shell (see
            // KeystoneShellController::settings()); these routes are the
            // mutation endpoints the panel POSTs/PATCHes/DELETEs against.
            // Admin-only per the same policy as the top-level Privacy nav:
            // exposing regulation toggles, DPO contact, and
            // consent-category management would let editors silently
            // disable compliance guardrails.
            Route::prefix('settings')
                ->name('settings.')
                ->group(function (): void {
                    Route::post('privacy', [SettingsPrivacyController::class, 'update'])->name('privacy.update');
                    Route::post('privacy/categories', [SettingsPrivacyController::class, 'storeCategory'])->name('privacy.categories.store');
                    Route::patch('privacy/categories/{category}', [SettingsPrivacyController::class, 'updateCategory'])->name('privacy.categories.update');
                    Route::delete('privacy/categories/{category}', [SettingsPrivacyController::class, 'destroyCategory'])->name('privacy.categories.destroy');

                    // #98.3 — Settings > Performance. Same pattern as
                    // Settings > Privacy: the panel is rendered inline
                    // inside `admin/Settings`; this is the mutation
                    // endpoint. Admin-only because flipping page cache
                    // or fragment cache off silently in production can
                    // spike origin load.
                    Route::post('performance', [SettingsPerformanceController::class, 'update'])->name('performance.update');
                });

            // #25 — Theme upload UI. Admin-only per the install-gating
            // decision in plans/08-themes-site-editor-arc.md: the
            // cms-framework Themes module exposes the capability,
            // Keystone owns the gate.
            Route::prefix('site-design')->name('site-design.')->group(function (): void {
                Route::get('themes', [ThemeController::class, 'index'])->name('themes.index');
                Route::post('themes', [ThemeController::class, 'store'])->name('themes.store');
                Route::post('themes/{slug}/activate', [ThemeController::class, 'activate'])->name('themes.activate');
                Route::delete('themes/{slug}', [ThemeController::class, 'destroy'])->name('themes.destroy');

                // #19 — Global Content (Business Info) panel. Edits the
                // `global.*` settings registered in SettingsServiceProvider
                // so reads via `apGetSetting('global.<key>')` work
                // anywhere (controllers, Blade, Inertia props).
                Route::get('business-info', [BusinessInfoController::class, 'edit'])->name('business-info.edit');
                Route::patch('business-info', [BusinessInfoController::class, 'update'])->name('business-info.update');
            });

            // #99 — Plugin management. Same install-gating logic as themes:
            // installing a plugin registers a service provider and runs
            // migrations, so admin-only. Calls the framework's
            // PluginManager/UpdateManager directly rather than the
            // /api/v1/plugins JSON API, which is only `auth`-gated.
            Route::prefix('system')->name('system.')->group(function (): void {
                Route::get('plugins', [PluginController::class, 'index'])->name('plugins.index');
                Route::post('plugins', [PluginController::class, 'store'])->name('plugins.store');
                // #109 — explicit refresh so the index render never blocks
                // on remote update-server HTTP. Declared before the
                // `{slug}` action routes so the literal path segment wins.
                // Rate-limited because the action synchronously fans out
                // an HTTP call per plugin (up to N × 10s per invocation):
                // an admin double-clicking with many plugins installed
                // shouldn't be able to pin PHP workers.
                Route::post('plugins/check-updates', [PluginController::class, 'checkUpdates'])
                    ->middleware('throttle:3,1')
                    ->name('plugins.check-updates');
                Route::post('plugins/{slug}/activate', [PluginController::class, 'activate'])->name('plugins.activate');
                Route::post('plugins/{slug}/deactivate', [PluginController::class, 'deactivate'])->name('plugins.deactivate');
                Route::post('plugins/{slug}/update', [PluginController::class, 'update'])->name('plugins.update');
                Route::delete('plugins/{slug}', [PluginController::class, 'destroy'])->name('plugins.destroy');
            });

            // #105 — Content Model admin. Wraps the framework's
            // ContentTypes managers (ContentType/Taxonomy/CustomField)
            // directly, same pattern as themes/plugins. Admin-only:
            // creating a content type mutates the DB schema
            // (CustomFieldManager::addColumnToTable) and registers
            // filter hooks, which is the same install-shaped surface
            // that gates themes and plugins.
            Route::prefix('content-model')->name('content-model.')->group(function (): void {
                Route::get('content-types', [ContentTypeController::class, 'index'])->name('content-types.index');
                Route::post('content-types', [ContentTypeController::class, 'store'])->name('content-types.store');
                Route::get('content-types/{contentType}/edit', [ContentTypeController::class, 'edit'])->name('content-types.edit');
                Route::put('content-types/{contentType}', [ContentTypeController::class, 'update'])->name('content-types.update');
                Route::delete('content-types/{contentType}', [ContentTypeController::class, 'destroy'])->name('content-types.destroy');

                Route::get('taxonomies', [TaxonomyController::class, 'index'])->name('taxonomies.index');
                Route::post('taxonomies', [TaxonomyController::class, 'store'])->name('taxonomies.store');
                Route::get('taxonomies/{taxonomy}/edit', [TaxonomyController::class, 'edit'])->name('taxonomies.edit');
                Route::put('taxonomies/{taxonomy}', [TaxonomyController::class, 'update'])->name('taxonomies.update');
                Route::delete('taxonomies/{taxonomy}', [TaxonomyController::class, 'destroy'])->name('taxonomies.destroy');
                // Term creation inlined so the record-edit sidebar can
                // add terms without a round trip through a separate
                // Terms admin surface. Widened past the surrounding
                // `role:admin` group because the caller —
                // DynamicContentEdit — renders for
                // admin/site_owner/editor; keeping this admin-only
                // caused the sidebar's Add button to 403 silently.
                Route::post('taxonomies/{taxonomy}/terms', [TaxonomyController::class, 'storeTerm'])
                    ->withoutMiddleware('role:admin')
                    ->middleware('role:admin,site_owner,editor')
                    ->name('taxonomies.terms.store');

                Route::get('custom-fields', [CustomFieldController::class, 'index'])->name('custom-fields.index');
                Route::post('custom-fields', [CustomFieldController::class, 'store'])->name('custom-fields.store');
                Route::get('custom-fields/{customField}/edit', [CustomFieldController::class, 'edit'])->name('custom-fields.edit');
                Route::put('custom-fields/{customField}', [CustomFieldController::class, 'update'])->name('custom-fields.update');
                Route::delete('custom-fields/{customField}', [CustomFieldController::class, 'destroy'])->name('custom-fields.destroy');
            });

            // #43 — admin entry-point for the visual-editor site
            // editor. Serves the SPA blade directly so the editor
            // lives at `/admin/site-editor` (the catch-all `{path?}`
            // hands every SPA sub-path the same shell). The
            // `role:admin` middleware filters non-admins; the
            // controller additionally invokes the bound
            // `KeystoneSiteEditorGate` for the cms-framework install
            // probe.
            Route::get('site-editor/{path?}', SiteEditorController::class)
                ->where('path', '.*')
                ->name('site-editor');
        });
    });

/*
| Personal account settings live under `/admin/*` alongside the rest of the
| admin shell but skip the `verified` middleware so an unverified user can
| still reach their profile to (re)send the verification email.
*/
Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function (): void {
        Route::get('profile', [ProfileController::class, 'edit'])->name('profile');
        Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

        // Account pages live beneath `/admin/profile/*` to group them under the
        // user-profile section. Route names are kept flat (`admin.password`,
        // `admin.appearance`, `admin.two-factor`) so existing references hold.
        Route::prefix('profile')->group(function (): void {
            Route::get('password', [PasswordController::class, 'edit'])->name('password');
            Route::put('password', [PasswordController::class, 'update'])->name('password.update');

            Route::get('appearance', [AppearanceController::class, 'edit'])->name('appearance');

            Route::get('two-factor', [TwoFactorController::class, 'edit'])->name('two-factor');
            Route::post('two-factor', [TwoFactorController::class, 'store'])->name('two-factor.store');
            Route::delete('two-factor', [TwoFactorController::class, 'destroy'])->name('two-factor.destroy');
        });
    });
