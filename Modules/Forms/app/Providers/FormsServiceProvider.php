<?php

declare(strict_types=1);

namespace Modules\Forms\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\Forms\Models\Form as PackageForm;
use Illuminate\Support\Facades\Route;

/**
 * Boots the Forms module.
 *
 * Like Analytics, Auth, Users and Media, there was no
 * `app/Providers/*ServiceProvider.php` to absorb here (#210) — forms
 * themselves are artisanpack-ui/forms, which registers its own provider,
 * models, `/api/v1/forms/*` routes and migrations. Keystone's Forms module is
 * the surface around it: the admin builder and submissions inbox, the public
 * single-form page, and the one route binding that moved out of
 * `App\Providers\AppServiceProvider`. `bootstrap/providers.php` is therefore
 * untouched by the extraction.
 *
 * The module owns no migrations, factories or seeders — the `forms` and
 * `form_submissions` tables and their factories belong to the package — so
 * `database/` and its autoload entries were stripped from the generated
 * scaffolding rather than left empty.
 *
 * Nothing is read at boot, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does
 * not apply. See {@see boot()} for why the earlier boot is safe for the
 * binding itself.
 */
class FormsServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Forms';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'forms';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Bootstrap the module.
     *
     * Overrides the artisanpack-ui/forms route binding so admin and API
     * consumers can address a form by its primary key (stable across renames)
     * while public visitors keep slug-based URLs.
     *
     * The package's `Form::getRouteKeyName()` returns 'slug', so without this
     * an in-progress slug edit would break the very PUT request trying to
     * persist it.
     *
     * Every `{form}` route reaches this closure, admin ones included —
     * `Router::substituteBindings()` applies a registered explicit binder to
     * any matching parameter *before* implicit binding runs, so the `{form:id}`
     * field the admin routes declare is inert for as long as this binder
     * exists. (The comment this replaced, carried from `AppServiceProvider`,
     * claimed the opposite.) The `routeIs()` dispatch below is therefore the
     * only thing making admin URLs id-based; `{form:id}` stays in the route
     * file as the declaration of intent and the fallback if this binder is
     * ever dropped.
     *
     * Numeric-first across all routes (the previous behavior) lets a public
     * visitor's slug like `2024` resolve as form id 2024 instead — wrong
     * record, hard-to-debug bug. Dispatching on the matched route name keeps
     * the public path slug-only without that ambiguity.
     *
     * `ctype_digit` is a **discriminator inside the `&&`, not a guard** — read
     * it as "numeric on an id-capable route means an id", not as "id routes
     * only accept numbers". Hoisting it out and 404ing non-numeric values on
     * `api.forms.*` is a tempting-looking tightening that breaks public forms
     * outright: the package's `api.forms.render` and `api.forms.submit` are the
     * endpoints `<FormRenderer />` calls, and it calls them with a **slug**
     * (`resources/js/vendor/artisanpack-forms/react/hooks/useForm.ts` →
     * `${baseUrl}/${encodeURIComponent(formSlug)}/render`). `api.forms.*` is
     * therefore id-*capable*, not id-only. `FormRouteBindingTest` pins all
     * three branches so that change fails the suite rather than production.
     *
     * Safe to register earlier in the provider chain than `AppServiceProvider`,
     * where this used to live: `Route::bind()` is last-registration-wins, and
     * the forms package binds nothing for the `form` parameter itself — it
     * relies on implicit binding through `getRouteKeyName()`, which an explicit
     * binder overrides regardless of order. Nothing else in the app or in
     * vendor binds `form`, so there is no registration that could now win the
     * race and shadow this closure.
     */
    public function boot(): void
    {
        parent::boot();

        Route::bind('form', function (string $value): PackageForm {
            $request = request();

            $isIdRoute = ctype_digit($value)
                && ($request->routeIs('api.forms.*') || $request->routeIs('admin.forms.*'));

            if ($isIdRoute) {
                return PackageForm::query()->findOrFail((int) $value);
            }

            return PackageForm::query()->where('slug', $value)->firstOrFail();
        });
    }
}
