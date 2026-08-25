<?php

declare(strict_types=1);

namespace Modules\Pages\Providers;

use App\Providers\KeystoneModuleServiceProvider;

/**
 * Boots the Pages module.
 *
 * Like Analytics, Auth, Users, Media, Forms and Blog, there was no
 * `app/Providers/*ServiceProvider.php` to absorb here (#212) — pages are
 * artisanpack-ui/cms-framework's Pages module, which owns the `Page` model, the
 * `pages` table and its migration and factory, and `PageManager`. Keystone's
 * module is the surface around it: the admin CRUD at `/admin/pages` and the
 * public renderer that turns a resolved page into theme HTML. So this provider
 * registers only the module's `RouteServiceProvider`, `bootstrap/providers.php`
 * is untouched by the extraction, and `database/` was stripped from the
 * generated scaffolding along with its two autoload entries rather than
 * committed empty — the same call Auth, Media, Forms and Blog made.
 *
 * Nothing moved out of `App\Providers\AppServiceProvider` either. Every
 * page-shaped registration in core turned out to be about something else that
 * merely mentions pages: `AdminMenuBuilder` builds the nav from
 * `admin.pages.*` route *names* (which this extraction preserves),
 * `SpecializedContentTypes` reserves the `page`/`pages` slugs on behalf of
 * ContentModel, and `ThemeSeedApplier`, `PreviewController` and
 * `SiteAtAGlanceWidget` all reach for the vendor `Page` model directly. None of
 * them is a binding, gate or hook this module could own.
 *
 * Nothing is read at boot, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does not
 * apply. The one setting the public renderer depends on, `site.homepageId`, is
 * read per request inside `PublicPageController::resolveHomepage()`, long after
 * every provider has booted — and it already falls back to the `home` slug when
 * the read comes back empty.
 */
class PagesServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Pages';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'pages';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];
}
