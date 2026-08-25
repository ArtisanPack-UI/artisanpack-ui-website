<?php

declare(strict_types=1);

namespace Modules\Installer\Console\Commands;

use Illuminate\Console\Command;
use InvalidArgumentException;
use Modules\Installer\Services\InstallationService;
use Modules\Installer\Support\InstallationOptions;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\password;
use function Laravel\Prompts\select;
use function Laravel\Prompts\text;

/**
 * Interactive (or scripted) installer for a fresh Keystone site.
 *
 * Wraps {@see InstallationService}, which is also reused by the `/install`
 * web wizard. See `plans/06-keystone-plan.md` §5.3.
 */
class InstallCommand extends Command
{
    protected $signature = 'keystone:install
        {--site-type= : sbdf_pro or custom_crafted}
        {--business-name= : Display name for the client business}
        {--primary-domain= : Primary domain, e.g. example.com}
        {--admin-name= : Admin user display name}
        {--admin-email= : Admin user email}
        {--admin-password= : Admin password (random if omitted)}
        {--site-owner-email= : Optional client owner email}
        {--theme-zip= : Optional path to a theme .zip to install + activate}
        {--cloudflare-zone= : Optional Cloudflare zone ID}';

    protected $description = 'Provision a fresh Keystone CMS site: migrate, seed, install theme, create users, cache, and mark .installed.';

    public function handle(InstallationService $installer): int
    {
        if ($this->isInstalled($installer) && ! $this->shouldContinueOnInstalled()) {
            $this->warn('Site is already installed. Aborting.');

            return self::SUCCESS;
        }

        try {
            $options = $this->collectOptions();
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::INVALID;
        }

        $this->line('');
        $this->info('Running installer…');

        $report = $installer->install($options);

        $this->line('');

        foreach ($report->steps as $step) {
            $icon = match ($step['status']) {
                'ok'      => '✓',
                'skipped' => '○',
                'failed'  => '✗',
                default   => '·',
            };

            $line = sprintf('  %s %-12s %s', $icon, $step['step'], $step['status']);

            if (null !== $step['detail']) {
                $line .= ' — '.$step['detail'];
            }

            $this->line($line);
        }

        $this->line('');

        if ($report->hasFailures()) {
            $this->error('Install completed with failures: '.implode(', ', $report->failedSteps()));

            return self::FAILURE;
        }

        if (null !== $report->adminPassword) {
            $this->info('Generated admin password (store this now, it will not be shown again):');
            $this->line('  '.$report->adminPassword);
            $this->line('');
        }

        $domain = '' !== $options->primaryDomain ? "https://{$options->primaryDomain}/admin" : '/admin';
        $this->info("Site is ready: {$domain}");

        return self::SUCCESS;
    }

    private function collectOptions(): InstallationOptions
    {
        $interactive = ! (bool) $this->option('no-interaction');

        $siteType      = $this->resolveSiteType($interactive);
        $businessName  = $this->resolveString('business-name', 'Business name', $interactive, required: true);
        $primaryDomain = $this->resolveString('primary-domain', 'Primary domain', $interactive, required: true);
        $adminName     = $this->resolveString('admin-name', 'Admin name', $interactive, required: true);
        $adminEmail    = $this->resolveString('admin-email', 'Admin email', $interactive, required: true);

        $adminPassword   = $this->resolveAdminPassword($interactive);
        $siteOwnerEmail  = $this->resolveString('site-owner-email', 'Site owner email (optional)', $interactive, required: false);
        $themeZipPath    = $this->resolveString('theme-zip', 'Theme zip path (optional)', $interactive, required: false);
        $cloudflareZone  = $this->resolveString('cloudflare-zone', 'Cloudflare zone ID (optional)', $interactive, required: false);

        return new InstallationOptions(
            siteType: $siteType,
            businessName: $businessName,
            primaryDomain: $primaryDomain,
            adminName: $adminName,
            adminEmail: $adminEmail,
            adminPassword: '' === $adminPassword ? null : $adminPassword,
            siteOwnerEmail: '' === $siteOwnerEmail ? null : $siteOwnerEmail,
            themeZipPath: '' === $themeZipPath ? null : $themeZipPath,
            cloudflareZoneId: '' === $cloudflareZone ? null : $cloudflareZone,
        );
    }

    private function resolveSiteType(bool $interactive): string
    {
        $value = (string) ($this->option('site-type') ?? '');

        if ('' === $value && $interactive) {
            $value = select(
                label: 'Site type',
                options: ['sbdf_pro' => 'SBDF Pro', 'custom_crafted' => 'Custom Crafted'],
                default: 'sbdf_pro',
            );
        }

        if ('' === $value) {
            $value = 'sbdf_pro';
        }

        if (! in_array($value, ['sbdf_pro', 'custom_crafted'], true)) {
            throw new InvalidArgumentException("Invalid --site-type: {$value}");
        }

        return $value;
    }

    private function resolveString(string $option, string $label, bool $interactive, bool $required): string
    {
        $value = (string) ($this->option($option) ?? '');

        if ('' === $value && $interactive) {
            $value = text(
                label: $label,
                required: $required,
            );
        }

        if ('' === $value && $required) {
            throw new InvalidArgumentException("Missing required option --{$option}.");
        }

        return $value;
    }

    private function resolveAdminPassword(bool $interactive): string
    {
        $value = (string) ($this->option('admin-password') ?? '');

        if ('' !== $value || ! $interactive) {
            return $value;
        }

        if (! confirm('Generate a random admin password?', default: true)) {
            return password(label: 'Admin password', required: true);
        }

        return '';
    }

    private function isInstalled(InstallationService $installer): bool
    {
        return is_file($installer->installedFlagPath());
    }

    private function shouldContinueOnInstalled(): bool
    {
        if ((bool) $this->option('no-interaction')) {
            // Idempotent re-run support for CI.
            return true;
        }

        return confirm('Site is already installed. Re-run installer (idempotent)?', default: false);
    }
}
