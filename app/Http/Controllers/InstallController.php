<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Middleware\Installed;
use App\Http\Requests\InstallRequest;
use App\Installer\InstallationOptions;
use App\Installer\InstallationService;
use App\Support\EnvWriter;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Web wrapper around {@see InstallationService} — the same service the
 * `keystone:install` CLI uses. See `plans/06-keystone-plan.md` §5.3.
 *
 * Routes here are gated by `installed:guard` (token + IP + flag-absence);
 * the controller assumes those checks have already passed.
 */
class InstallController extends Controller
{
    public function show(Request $request): Response
    {
        // Stamp a session grant so the wizard's POST can be authorized off
        // the session instead of carrying the install token in the URL.
        // The middleware has already validated token + IP + flag-absence.
        $request->session()->put(Installed::SESSION_GRANT_KEY, true);

        return Inertia::render('Install', [
            'siteTypes' => [
                ['value' => 'sbdf_pro', 'label' => 'SBDF Pro'],
                ['value' => 'custom_crafted', 'label' => 'Custom Crafted'],
            ],
            'defaults' => [
                'site_type' => (string) config('keystone.site_type', 'sbdf_pro'),
            ],
        ]);
    }

    public function store(
        InstallRequest $request,
        InstallationService $installer,
        EnvWriter $env,
    ): Response {
        $data = $request->validated();

        $options = new InstallationOptions(
            siteType: (string) $data['site_type'],
            businessName: (string) $data['business_name'],
            primaryDomain: (string) $data['primary_domain'],
            adminName: (string) $data['admin_name'],
            adminEmail: (string) $data['admin_email'],
            adminPassword: $this->nullIfBlank($data['admin_password'] ?? null),
            siteOwnerEmail: $this->nullIfBlank($data['site_owner_email'] ?? null),
            themeZipPath: $this->nullIfBlank($data['theme_zip_path'] ?? null),
            cloudflareZoneId: $this->nullIfBlank($data['cloudflare_zone_id'] ?? null),
        );

        $report = $installer->install($options);

        // The InstallationService writes `.installed` only on a clean run;
        // mirror that here for the token so a failed install leaves the
        // operator's URL valid for a retry. The session grant is single-
        // use too — clear it so an opened tab can't re-POST against a
        // partially-installed site.
        if (! $report->hasFailures()) {
            $env->set('KEYSTONE_INSTALL_TOKEN', Str::random(64));
            $request->session()->forget(Installed::SESSION_GRANT_KEY);
        }

        return Inertia::render('Install', [
            'siteTypes' => [
                ['value' => 'sbdf_pro', 'label' => 'SBDF Pro'],
                ['value' => 'custom_crafted', 'label' => 'Custom Crafted'],
            ],
            'defaults' => [
                'site_type' => (string) $data['site_type'],
            ],
            'result' => [
                'success'             => ! $report->hasFailures(),
                'steps'               => $report->steps,
                'failed_steps'        => $report->failedSteps(),
                'admin_email'         => (string) $data['admin_email'],
                'admin_password'      => $report->adminPassword,
                'site_owner_password' => $options->generatedSiteOwnerPassword,
                'primary_domain'      => (string) $data['primary_domain'],
            ],
        ]);
    }

    private function nullIfBlank(?string $value): ?string
    {
        if (null === $value) {
            return null;
        }

        $trimmed = trim($value);

        return '' === $trimmed ? null : $trimmed;
    }
}
