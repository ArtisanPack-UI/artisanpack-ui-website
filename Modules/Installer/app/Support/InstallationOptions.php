<?php

declare(strict_types=1);

namespace Modules\Installer\Support;

/**
 * Mutable bag of installer inputs. The CLI command and `/install` web wizard
 * both build one of these and hand it to
 * {@see \Modules\Installer\Services\InstallationService::install()}.
 */
class InstallationOptions
{
    public ?string $generatedAdminPassword = null;

    public ?string $generatedSiteOwnerPassword = null;

    public function __construct(
        public string $siteType = 'sbdf_pro',
        public string $businessName = '',
        public string $primaryDomain = '',
        public string $adminName = '',
        public string $adminEmail = '',
        public ?string $adminPassword = null,
        public ?string $siteOwnerEmail = null,
        public ?string $themeZipPath = null,
        public ?string $cloudflareZoneId = null,
    ) {}
}
