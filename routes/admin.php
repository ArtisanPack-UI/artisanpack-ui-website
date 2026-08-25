<?php

declare(strict_types=1);

use App\Http\Controllers\Admin\KeystoneShellController;
use App\Http\Controllers\Admin\NotificationPreferenceController;
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
        // The `admin.dashboard` landing route and the whole
        // `admin.dashboards.*` CRUD group live in the SiteEditor module
        // (`Modules/SiteEditor/routes/admin.php`). They need no extra role
        // gate — every authenticated admin user has a dashboard — so the
        // module reapplies only the shared stack this group declares.

        // The `admin.editor-preferences.*` routes live in the Users module
        // (`Modules/Users/routes/admin.php`), which reapplies
        // `role:admin,site_owner,editor` inside its own route file.

        // The `admin.pages.*` routes live in the Pages module
        // (`Modules/Pages/routes/admin.php`), which reapplies
        // `role:admin,site_owner,editor` inside its own route file.

        // The `admin.posts.*` routes — including the `posts.categories.*` and
        // `posts.tags.*` taxonomy resources — live in the Blog module
        // (`Modules/Blog/routes/admin.php`), which reapplies both
        // `role:admin,site_owner,editor` and `feature:blog` inside its own
        // route file.

        // The `admin.media.index` route lives in the Media module
        // (`Modules/Media/routes/admin.php`), which reapplies
        // `role:admin,site_owner,editor` inside its own route file.

        // The `admin.content.*` generic content-type CRUD lives in the
        // ContentModel module (`Modules/ContentModel/routes/admin.php`), which
        // reapplies `role:admin,site_owner,editor` inside its own route file.

        // The `admin.seo.*` redirect routes live in the Seo module
        // (`Modules/Seo/routes/admin.php`), which reapplies
        // `role:admin,site_owner,editor` inside its own route file.

        Route::get('products', [KeystoneShellController::class, 'products'])->name('products');
        Route::get('orders', [KeystoneShellController::class, 'orders'])->name('orders');
        Route::get('customers', [KeystoneShellController::class, 'customers'])->name('customers');

        // The `admin.forms.*` group lives in the Forms module
        // (`Modules/Forms/routes/admin.php`), which reapplies
        // `feature:forms` inside its own route file.

        Route::get('site-design', [KeystoneShellController::class, 'siteDesign'])->name('site-design');
        Route::get('settings', [KeystoneShellController::class, 'settings'])->name('settings');
        Route::get('integrations', [KeystoneShellController::class, 'integrations'])->name('integrations');
        Route::get('activity-log', [KeystoneShellController::class, 'activityLog'])->name('activity-log');
        Route::get('notifications/preferences', [NotificationPreferenceController::class, 'index'])->name('notifications.preferences');
        Route::get('notifications', [KeystoneShellController::class, 'notifications'])->name('notifications');

        // The `admin.users.*` resource lives in the Users module
        // (`Modules/Users/routes/admin.php`), which reapplies
        // `role:admin,site_owner` inside its own route file.

        // The top-level `admin.privacy.*` nav lives in the Privacy module
        // (`Modules/Privacy/routes/admin.php`), the top-level
        // `admin.performance.*` nav in the Performance module
        // (`Modules/Performance/routes/admin.php`), and `admin.reports` in
        // the Analytics module (`Modules/Analytics/routes/admin.php`).

        Route::middleware('role:admin')->group(function (): void {
            // `admin.roles.*` and `admin.permissions.index` live in the
            // Users module (`Modules/Users/routes/admin.php`), which
            // reapplies `role:admin` inside its own route file.

            // `admin.settings.updates*` lives in the Updater module
            // (`Modules/Updater/routes/admin.php`),
            // `admin.settings.privacy.*` in the Privacy module
            // (`Modules/Privacy/routes/admin.php`) and
            // `admin.settings.performance.update` in the Performance
            // module (`Modules/Performance/routes/admin.php`). All three
            // reapply `role:admin` inside their own route file.

            // The `admin.site-design.*` group — theme upload/activation and the
            // Business Info panel — lives in the Themes module
            // (`Modules/Themes/routes/admin.php`), which reapplies `role:admin`
            // inside its own route file. The bare `admin.site-design` shell
            // route above stays here with the rest of KeystoneShellController.

            // The `admin.system.plugins.*` group lives in the Plugins module
            // (`Modules/Plugins/routes/admin.php`), which reapplies
            // `role:admin` inside its own route file.

            // The `admin.content-model.*` screens live in the ContentModel
            // module (`Modules/ContentModel/routes/admin.php`), which reapplies
            // `role:admin` inside its own route file.

            // The `admin.site-editor` entry point lives in the SiteEditor
            // module (`Modules/SiteEditor/routes/admin.php`), which reapplies
            // `role:admin` inside its own route file.
        });
    });

/*
| Personal account settings (`admin.profile*`, `admin.password*`,
| `admin.appearance`, `admin.two-factor*`) live in the Users module
| (`Modules/Users/routes/account.php`). They sit under `/admin/*` alongside
| the rest of the admin shell but skip the `verified` middleware, so the
| module maps them from their own file rather than folding them into the
| shared admin group.
*/
