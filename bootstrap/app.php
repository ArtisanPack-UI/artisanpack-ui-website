<?php

use App\Http\Middleware\EnsureFeatureIsEnabled;
use App\Http\Middleware\EnsureSiteIsAccessible;
use App\Http\Middleware\EnsureTwoFactorEnrollment;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\InjectPrivacyBanner;
use App\Http\Middleware\Installed;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            InjectPrivacyBanner::class,
        ]);

        // Sanctum SPA cookie auth: stamps cross-cutting `api` middleware so
        // the artisanpack-ui/media-library JSON routes accept the admin
        // session cookie instead of requiring bearer tokens. Stateful
        // domains are listed in config/sanctum.php.
        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        // Public, unauthenticated POSTs go through the api middleware group
        // — which is stateful via Sanctum above, which means VerifyCsrfToken
        // gates them. The forms package's public `/render` and `/submit`
        // endpoints are meant for anonymous visitors who haven't been
        // through `/sanctum/csrf-cookie`, so requiring a CSRF token would
        // hand them a 419 on every first submit. Exempting them here
        // matches the public form rendering contract: the package already
        // ships honeypot + rate-limit spam protection.
        $middleware->validateCsrfTokens(except: [
            'api/v1/forms/*/submit',
        ]);

        $middleware->alias([
            'feature'           => EnsureFeatureIsEnabled::class,
            'installed'         => Installed::class,
            'site.access'       => EnsureSiteIsAccessible::class,
            'two-factor.enroll' => EnsureTwoFactorEnrollment::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
