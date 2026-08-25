<?php

declare(strict_types=1);

namespace Modules\Auth\Providers;

use App\Providers\KeystoneModuleServiceProvider;

/**
 * Boots the Auth module.
 *
 * Unlike Performance, Privacy, Seo and Updater, there was no
 * `app/Providers/*ServiceProvider.php` to absorb here (#207) — Keystone's
 * authentication surface was pure controllers plus `routes/auth.php`, with
 * the guard/provider/broker configuration living in `config/auth.php` and the
 * 2FA session middleware supplied by `artisanpack-ui/security-auth`. So this
 * provider only registers the module's `RouteServiceProvider`, and
 * `bootstrap/providers.php` is untouched by the extraction.
 *
 * Nothing is read at boot, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does
 * not apply. `LoginRequest` does read `security.loginAttempts` and
 * `security.loginTimeout` through `SettingsManager`, but it resolves the
 * manager per request, long after every provider has booted.
 *
 * The module owns no tables, factories or seeders — the `User` model and its
 * factory belong to the Users module (#208), which this module reaches across
 * to via `Modules\Users\Models\User` — so the generated `database/` directory
 * was deleted rather than left empty.
 */
class AuthServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Auth';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'auth';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];
}
