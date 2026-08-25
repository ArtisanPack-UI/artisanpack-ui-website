<?php

declare(strict_types=1);

namespace Modules\Users\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Foundation\AliasLoader;
use Modules\Users\Models\User;

/**
 * Boots the Users module.
 *
 * Like Analytics and Auth, there was no `app/Providers/*ServiceProvider.php`
 * to absorb here (#208) — user, role and permission management was
 * controllers, models and route groups, with the guard/provider wiring in
 * `config/auth.php` and roles/permissions themselves supplied by
 * cms-framework's Users module. So this provider registers the module's
 * `RouteServiceProvider` and loads the two migrations that moved into
 * `database/migrations` alongside it, and `bootstrap/providers.php` is
 * untouched by the extraction.
 *
 * Nothing is read at boot, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does
 * not apply.
 *
 * Two things about the module's database surface are worth stating, because
 * neither is what the §4 inventory implies:
 *
 * - **`0001_01_01_000000_create_users_table.php` deliberately stays central.**
 *   Laravel ships it creating three tables — `users`, `password_reset_tokens`
 *   and `sessions` — and only the first belongs to this module. Splitting it
 *   is not an option: §3.6 pins migration *filenames* because the `migrations`
 *   table matches on them, so the file can move whole or not at all, and
 *   moving it whole would hand the session store and the password broker's
 *   table to Users. The two migrations that are purely this module's —
 *   the profile overhaul and `user_editor_preferences` — did move. Ordering
 *   survives the split because Laravel's migrator sorts by filename across
 *   every registered path, so the central `0001_…` create still runs before
 *   the module's `2026_…` alter.
 * - **`User::dashboards()` points into another module.** The `Dashboard`
 *   model was still central when Users was extracted; #215 moved it into the
 *   SiteEditor module, so the relation now names
 *   `Modules\SiteEditor\Models\Dashboard`.
 */
class UsersServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Users';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'users';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Register the module.
     *
     * Keeps `App\Models\User` resolvable as an alias of the moved model.
     *
     * cms-framework exposes `artisanpack.cms-framework.user_model` precisely
     * so the host app can name its own User model, and its models, Role
     * relation and Users controller all honour it — but
     * `Modules\Blog\Database\Factories\PostFactory` and
     * `Modules\Pages\Database\Factories\PageFactory` skip the config and
     * `use App\Models\User` outright, calling `User::factory()` for
     * `author_id`. Nothing in Keystone references the old name any more, so
     * without this alias those two factories fatal with "Class
     * `App\Models\User` not found" the moment any test creates a post or a
     * page — roughly a fifth of the suite.
     *
     * Registered through {@see AliasLoader} rather than a bare
     * `class_alias()` so the alias is created lazily, only when something
     * actually asks for the old name, and unconditionally rather than under
     * `runningUnitTests()`: a testing-only shim would let app code
     * reintroduce `App\Models\User` with a green suite and a fatal in
     * production. Delete this once the upstream factories resolve the
     * configured user model like the rest of the package does — tracked at
     * ArtisanPack-UI/cms-framework#279, milestone v2.8. Note this is the
     * alias only; {@see pinLegacyMorphAlias()} is a separate seam that
     * outlives it.
     */
    public function register(): void
    {
        parent::register();

        AliasLoader::getInstance(['App\Models\User' => User::class])->register();

        $this->pinLegacyMorphAlias();
    }

    /**
     * Keep `App\Models\User` as the model's polymorphic type string.
     *
     * Renaming the class silently rewrites what `getMorphClass()` returns,
     * and every already-migrated site has rows keyed on the old value.
     * artisanpack-ui/privacy is the live example: it both writes
     * (`ConsentService:147`, `DataRequestService:161`,
     * `DataDeletionService:177`) and reads (`DataExportService:147/175`,
     * `ReconsentService:172/263`, `DataDeletionService:203`,
     * `PrivacyDashboard:213`) with `$subject->getMorphClass()`, so without
     * this map a site's whole consent and data-request history stops
     * matching the moment it upgrades — including
     * `privacy_scheduled_deletions`, which means an erasure request booked
     * before the upgrade would never be executed. Nothing errors; the
     * queries just return zero rows.
     *
     * A `Relation::morphMap()` entry is preferred over a data migration
     * that rewrites the type columns, because completeness here cannot be
     * verified: the morph columns that can hold a user are spread across
     * artisanpack-ui/privacy, media-library and security-auth, and any
     * installed Keystone plugin can add more. Mapping the class covers all
     * of them, including tables this codebase has never heard of, and is
     * reversible. Not `enforceMorphMap()` — that would demand a map entry
     * for every other morphable model in the app and its packages.
     *
     * The alias deliberately stays the historical FQCN rather than a
     * tidier `'user'`: a shorter key is a different string, so it would
     * need the same unverifiable data migration to adopt. Switching to
     * one is a follow-up with its own issue, not part of a
     * behaviour-preserving extraction.
     */
    protected function pinLegacyMorphAlias(): void
    {
        Relation::morphMap(['App\Models\User' => User::class]);
    }
}
