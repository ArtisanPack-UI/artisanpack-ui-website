<?php

declare(strict_types=1);

namespace Modules\Installer\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use Modules\Installer\Console\Commands\InstallCommand;

/**
 * Boots the Installer module.
 *
 * The module owns Keystone's two provisioning surfaces — the `keystone:install`
 * CLI command and the `/install` web wizard — plus the `InstallationService`
 * both drop into, the `Installed` middleware that gates the wizard, and the
 * `.installed` flag that closes it. See `plans/06-keystone-plan.md` §5.3.
 *
 * There was no `app/Providers/*ServiceProvider.php` to absorb and no binding,
 * gate or hook registration in `App\Providers\AppServiceProvider` to move, so
 * `bootstrap/providers.php` is untouched by this extraction; the only wiring
 * that changed hands is the command discovery below and the route mapping in
 * {@see RouteServiceProvider}. `database/` was stripped from the generated
 * scaffolding along with its autoload entries rather than committed empty —
 * the installer runs `migrate` against everyone else's tables and owns none of
 * its own.
 *
 * Nothing here reads `SettingsManager`, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does
 * not apply. `InstallationService` does write settings through
 * `SettingsManager`, but only from inside `install()`, which runs per-request
 * or per-command — long after every provider has booted.
 *
 * Two things stayed in core on purpose:
 *
 * - **The `installed` middleware alias** in `bootstrap/app.php`, which now
 *   points at {@see \Modules\Installer\Http\Middleware\Installed}. §3.5 calls
 *   for exactly this ("`Installed` middleware ref … class itself moves to
 *   Installer"): every alias in the app is declared in one place, and the
 *   middleware's `require` mode is documented as an app-wide gate rather than
 *   an installer-only one. Same core→module shape as `InjectPrivacyBanner`.
 * - **`App\Support\EnvWriter`**, which `InstallationService` and
 *   `InstallController` both use to rewrite `.env`. It is the app-wide env
 *   writer — the updater and the settings screens use it too — not an
 *   installer concern (§3.5 lists it as central).
 *
 * `Support\KeystoneSampleData` moved here per §4 row 16 even though the
 * installer never calls it. It is admin-shell mockup data, so the move
 * inverts four existing dependencies: `KeystoneShellController` and
 * `HandleInertiaRequests` (both core, both staying core per §3.5) and the
 * SiteEditor and Analytics modules now all reach into this module for it. The
 * plan anticipates that inversion explicitly and treats the resulting
 * core→module import as the same shape as the ones Plugins and Seo already
 * carry. It disappears when the commerce placeholders become real and the
 * sample data is deleted outright.
 */
class InstallerServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Installer';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'installer';

    /**
     * Command classes to register.
     *
     * The command was auto-discovered from `app/Console/Commands` before the
     * move — Laravel's default command path, which does not extend into
     * `Modules/`. Listing it here restores discovery without changing the
     * `keystone:install` signature the install runbook and CI scripts use.
     *
     * @var string[]
     */
    protected array $commands = [
        InstallCommand::class,
    ];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];
}
