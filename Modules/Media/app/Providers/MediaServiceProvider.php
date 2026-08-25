<?php

declare(strict_types=1);

namespace Modules\Media\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\MediaLibrary\Http\Requests\MediaStoreRequest as PackageMediaStoreRequest;
use Modules\Media\Http\Requests\MediaStoreRequest as KeystoneMediaStoreRequest;

/**
 * Boots the Media module.
 *
 * Like Analytics, Auth and Users, there was no `app/Providers/*ServiceProvider.php`
 * to absorb here (#209) — the media library itself is
 * artisanpack-ui/media-library, which registers its own provider, models,
 * `/api/media/*` routes and migrations. Keystone's Media module is only the
 * admin shell around it: one Inertia route, one validation subclass, and the
 * shared "this id names a usable image" rule. So this provider registers the
 * module's `RouteServiceProvider` plus the one binding that moved out of
 * `App\Providers\AppServiceProvider`, and `bootstrap/providers.php` is
 * untouched by the extraction.
 *
 * `boot()` merges Keystone's extended upload MIMEs into
 * `artisanpack.media.allowed_mime_types`. It touches only that vendor config
 * key, never a `SettingsManager` default, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does
 * not apply. The request binding is inert until something resolves the request,
 * and the config it consults is read inside `getAllowedExtensions()` at
 * validation time.
 *
 * The module owns no migrations, factories or seeders: the `media` table and
 * its `MediaFactory` belong to the package, which is why `database/` and its
 * autoload entries were stripped from the generated scaffolding rather than
 * left empty.
 */
class MediaServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Media';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'media';

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
     * The vendor `MediaStoreRequest` has a closed MIME→extension map that
     * silently drops mimes it doesn't recognize (e.g. `audio/x-m4a`), so the
     * `mimes:` rule rejects uploads even after `artisanpack.media.allowed_mime_types`
     * allows them. Binding Keystone's subclass with the extra mappings is what
     * makes that config authoritative — see {@see KeystoneMediaStoreRequest}.
     *
     * Safe to register earlier in the provider chain than `AppServiceProvider`,
     * where this used to live: the package binds nothing for this contract
     * itself, so there is no vendor registration that could now win the race
     * and shadow the subclass.
     */
    public function register(): void
    {
        parent::register();

        $this->app->bind(PackageMediaStoreRequest::class, KeystoneMediaStoreRequest::class);
    }

    /**
     * Boot the module.
     *
     * The subclass can map Keystone's extended MIMEs to extensions, but
     * `getAllowedExtensions()` only emits an extension when its MIME is listed
     * in `artisanpack.media.allowed_mime_types` — and the vendor default stops
     * at `audio/ogg`. Fold the extended MIMEs into that config so a real upload
     * of a `.m4a`/`.heic` actually validates instead of the map entries being
     * dead. {@see KeystoneMediaStoreRequest::EXTENDED_MIME_EXTENSIONS} is the
     * single source of truth for the pair.
     *
     * The append is deferred to an `app->booted()` callback rather than run
     * inline. The vendor `MediaLibraryServiceProvider` assembles the real
     * `artisanpack.media.allowed_mime_types` list in *its* `boot()` (via
     * `array_replace_recursive` over a temp key), and provider boot order is
     * not guaranteed. Appending inline could therefore run first and set the
     * key to just our four MIMEs — which the vendor's index-keyed
     * `array_replace_recursive` would then splice over its own first four
     * defaults, silently dropping jpeg/png/gif. `booted()` fires after every
     * provider has booted, so the full vendor list is always present when we
     * append to it.
     */
    public function boot(): void
    {
        parent::boot();

        $this->app->booted(function (): void {
            $configKey = 'artisanpack.media.allowed_mime_types';
            $allowed   = (array) config($configKey, []);
            $extended  = array_keys(KeystoneMediaStoreRequest::EXTENDED_MIME_EXTENSIONS);

            config([$configKey => array_values(array_unique(array_merge($allowed, $extended)))]);
        });
    }
}
