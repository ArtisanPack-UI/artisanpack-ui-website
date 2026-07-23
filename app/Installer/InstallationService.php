<?php

declare(strict_types=1);

namespace App\Installer;

use App\Models\User;
use App\Support\EnvWriter;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use ArtisanPackUI\CMSFramework\Modules\Themes\Exceptions\ThemeInstallationException;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use Database\Seeders\KeystonePermissionsSeeder;
use Database\Seeders\KeystoneRolesSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

/**
 * Orchestrates per-site provisioning for the `keystone:install` command and
 * the `/install` web wizard. See `plans/06-keystone-plan.md` §5.3.
 *
 * Each step is idempotent — re-running on a half-installed site detects state
 * and skips completed work, so an installer crash can simply be retried.
 */
class InstallationService
{
    /**
     * Run the install. Each step appends to the returned report so callers
     * can render per-step status without re-discovering it.
     */
    public function install(InstallationOptions $options): InstallationReport
    {
        $report = new InstallationReport;

        $this->runMigrations($report);
        $this->seedDefaults($report);
        $this->persistSiteConfiguration($options, $report);
        $this->importTheme($options, $report);
        $admin = $this->createAdminUser($options, $report);
        $this->createSiteOwner($options, $report);
        $this->generateSitemap($report);
        $this->cacheFramework($report);

        // Only mark the site installed if every step succeeded — otherwise
        // the next run would hit InstallCommand's "already installed" branch
        // and skip the retry path the service is built to support.
        if (! $report->hasFailures()) {
            $this->writeInstalledFlag($report);
        }

        $report->adminUser     = $admin;
        $report->adminPassword = $options->generatedAdminPassword;

        return $report;
    }

    /**
     * Absolute path to the `.installed` flag file. Public so the CLI command
     * (and the `/install` web wizard) can detect prior installs without
     * duplicating the config lookup.
     */
    public function installedFlagPath(): string
    {
        return (string) config('keystone.install.flag_path', storage_path('app/.installed'));
    }

    private function runMigrations(InstallationReport $report): void
    {
        Artisan::call('migrate', ['--force' => true]);
        $report->step('migrate', 'ok');
    }

    private function seedDefaults(InstallationReport $report): void
    {
        // Inline the framework's three default roles instead of dispatching
        // its RolesTableSeeder by FQCN — cms-framework's `database/seeders/`
        // directory is case-mismatched against its PSR-4
        // `ArtisanPackUI\Database\` prefix, so on case-sensitive filesystems
        // (Linux CI) the class fails to autoload. See issue #88 and the note
        // in KeystonePermissionsSeederIntegrationTest. The framework's
        // PermissionsTableSeeder is intentionally skipped: its coarse slugs
        // (`manage-themes`, `manage-settings`) collide with Keystone's
        // dotted slugs and the Keystone seeder is the canonical source.
        try {
            foreach ($this->frameworkRoles() as $role) {
                Role::firstOrCreate(['slug' => $role['slug']], $role);
            }

            Artisan::call('db:seed', ['--class' => KeystoneRolesSeeder::class, '--force' => true]);
            Artisan::call('db:seed', ['--class' => KeystonePermissionsSeeder::class, '--force' => true]);
        } catch (Throwable $e) {
            // A seeder crash must surface as a structured `failed` step, not
            // escape and crash the command — the workflow is built around the
            // report and InstallCommand only catches option-validation errors.
            $report->step('seed', 'failed', $e::class.': '.$e->getMessage());

            return;
        }

        $report->step('seed', 'ok');
    }

    /**
     * @return list<array{name: string, slug: string, description: string}>
     */
    private function frameworkRoles(): array
    {
        return [
            ['name' => 'Admin',  'slug' => 'admin',  'description' => 'Full system access with all permissions'],
            ['name' => 'Editor', 'slug' => 'editor', 'description' => 'Content management access for creating and editing content'],
            ['name' => 'User',   'slug' => 'user',   'description' => 'Basic user access with limited permissions'],
        ];
    }

    /**
     * Persist installer-collected inputs so downstream boots see the
     * real site config:
     *
     *   - `KEYSTONE_SITE_TYPE` in .env (drives config('keystone.site_type')
     *     and the feature flags derived from it).
     *   - `site.title` + `site.url` in the settings table (drives the admin
     *     shell's brand + site props, SEO metadata, etc.).
     *
     * Runs after `seedDefaults()` so the `settings` table exists, and before
     * `cacheFramework()` so the .env write picks up in the fresh config cache.
     */
    private function persistSiteConfiguration(InstallationOptions $options, InstallationReport $report): void
    {
        try {
            $written = [];

            $siteType = trim($options->siteType);
            if ('' !== $siteType) {
                app(EnvWriter::class)->set('KEYSTONE_SITE_TYPE', $siteType);
                $written[] = "site_type={$siteType}";
            }

            $settings = app(SettingsManager::class);

            $businessName = trim($options->businessName);
            if ('' !== $businessName) {
                $settings->updateSetting('site.title', $businessName);
                $written[] = "title={$businessName}";
            }

            $primaryDomain = trim($options->primaryDomain);
            if ('' !== $primaryDomain) {
                $settings->updateSetting('site.url', $this->normalizeSiteUrl($primaryDomain));
                $written[] = "url={$primaryDomain}";
            }

            if ([] === $written) {
                $report->step('site_config', 'skipped', 'no site config provided');

                return;
            }

            $report->step('site_config', 'ok', implode(', ', $written));
        } catch (Throwable $e) {
            $report->step('site_config', 'failed', $e::class.': '.$e->getMessage());
        }
    }

    /**
     * Accept a bare domain ("example.com") or a full URL and return a URL
     * suitable for `site.url` — an absolute origin with a scheme. Local
     * installs against a Herd `.test` domain default to `http://`; every
     * other host defaults to `https://`.
     */
    private function normalizeSiteUrl(string $input): string
    {
        $input = trim($input);

        if (preg_match('#^https?://#i', $input)) {
            return rtrim($input, '/');
        }

        $host   = rtrim($input, '/');
        $scheme = str_ends_with(strtolower($host), '.test') ? 'http' : 'https';

        return $scheme.'://'.$host;
    }

    private function importTheme(InstallationOptions $options, InstallationReport $report): void
    {
        $zip = $options->themeZipPath;

        if (null === $zip || '' === $zip) {
            $report->step('theme', 'skipped');

            return;
        }

        if (! is_file($zip)) {
            $report->step('theme', 'failed', "Theme zip not found at {$zip}");

            return;
        }

        try {
            $manager  = app(ThemeManager::class);
            $manifest = $manager->installFromZip($zip);
            $slug     = (string) ($manifest['slug'] ?? '');

            if ('' !== $slug) {
                $manager->activateTheme($slug);
            }

            $report->step('theme', 'ok', "Installed theme: {$slug}");
        } catch (ThemeInstallationException $e) {
            // The framework throws `ThemeInstallationException::alreadyInstalled()`
            // when the slug directory already exists — that's the idempotent
            // re-run case and should not fail the install. Every other
            // ThemeInstallationException (extraction, ZIP-slip, etc.) is real.
            if (str_contains($e->getMessage(), 'already installed')) {
                $report->step('theme', 'skipped', $e->getMessage());

                return;
            }

            $report->step('theme', 'failed', $e->getMessage());
        } catch (Throwable $e) {
            $report->step('theme', 'failed', $e->getMessage());
        }
    }

    private function createAdminUser(InstallationOptions $options, InstallationReport $report): User
    {
        if ('' === $options->adminEmail) {
            throw new InvalidArgumentException('Admin email is required.');
        }

        $existing = User::query()->where('email', $options->adminEmail)->first();

        if (null !== $existing) {
            $report->step('admin', 'skipped', 'Admin user already exists.');
            $existing->assignRole('admin');

            return $existing;
        }

        $password = $options->adminPassword;

        if (null === $password || '' === $password) {
            $password                          = Str::password(16, symbols: false);
            $options->generatedAdminPassword   = $password;
        }

        $firstName = $this->firstNameFromFullName($options->adminName);
        $lastName  = $this->lastNameFromFullName($options->adminName);

        $user = User::query()->create([
            'first_name'        => $firstName,
            'last_name'         => $lastName,
            'username'          => $this->uniqueUsername($options->adminEmail),
            'display_name'      => '' !== trim($options->adminName) ? $options->adminName : $options->adminEmail,
            'email'             => $options->adminEmail,
            'email_verified_at' => now(),
            'password'          => Hash::make($password),
        ]);

        $user->assignRole('admin');

        $report->step('admin', 'ok', "Created admin: {$options->adminEmail}");

        return $user;
    }

    private function createSiteOwner(InstallationOptions $options, InstallationReport $report): void
    {
        $email = $options->siteOwnerEmail;

        if (null === $email || '' === $email) {
            $report->step('site_owner', 'skipped');

            return;
        }

        $existing = User::query()->where('email', $email)->first();

        if (null !== $existing) {
            $existing->assignRole('site_owner');
            $report->step('site_owner', 'skipped', 'Site owner already exists.');

            return;
        }

        $password = Str::password(16, symbols: false);

        $user = User::query()->create([
            'first_name'        => 'Site',
            'last_name'         => 'Owner',
            'username'          => $this->uniqueUsername($email),
            'display_name'      => '' !== $options->businessName ? $options->businessName.' Owner' : 'Site Owner',
            'email'             => $email,
            'email_verified_at' => now(),
            'password'          => Hash::make($password),
        ]);

        $user->assignRole('site_owner');
        $options->generatedSiteOwnerPassword = $password;

        $report->step('site_owner', 'ok', "Created site owner: {$email}");
    }

    private function generateSitemap(InstallationReport $report): void
    {
        try {
            Artisan::call('seo:generate-sitemap');
            $report->step('sitemap', 'ok');
        } catch (Throwable $e) {
            $report->step('sitemap', 'skipped', $e->getMessage());
        }
    }

    private function cacheFramework(InstallationReport $report): void
    {
        // config:cache writes bootstrap/cache/config.php and reloads from disk,
        // which clobbers runtime overrides used by the test suite and leaks
        // state between tests. The optimization is also irrelevant for an
        // in-memory sqlite test run.
        if (app()->environment('testing')) {
            $report->step('cache', 'skipped', 'testing environment');

            return;
        }

        foreach (['config:cache', 'route:cache', 'view:cache'] as $command) {
            try {
                Artisan::call($command);
            } catch (Throwable $e) {
                $report->step('cache', 'skipped', "{$command}: {$e->getMessage()}");

                return;
            }
        }

        $report->step('cache', 'ok');
    }

    private function writeInstalledFlag(InstallationReport $report): void
    {
        $path = $this->installedFlagPath();

        File::ensureDirectoryExists(dirname($path));
        File::put($path, now()->toIso8601String().PHP_EOL);

        $report->step('flag', 'ok', $path);
    }

    private function firstNameFromFullName(string $name): ?string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];

        return '' !== ($parts[0] ?? '') ? $parts[0] : null;
    }

    private function lastNameFromFullName(string $name): ?string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];

        if (count($parts) < 2) {
            return null;
        }

        return implode(' ', array_slice($parts, 1));
    }

    private function uniqueUsername(string $email): string
    {
        $base = Str::of($email)->before('@')->slug('_')->toString();

        if ('' === $base) {
            $base = 'user';
        }

        $candidate = $base;
        $suffix    = 1;

        while (User::query()->where('username', $candidate)->exists()) {
            $candidate = $base.'_'.(++$suffix);
        }

        return $candidate;
    }
}
