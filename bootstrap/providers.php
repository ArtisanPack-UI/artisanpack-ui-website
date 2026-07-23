<?php

use App\Providers\AppServiceProvider;
use App\Providers\DashboardWidgetServiceProvider;
use App\Providers\PerformanceServiceProvider;
use App\Providers\PrivacyServiceProvider;
use App\Providers\SeoIntegrationServiceProvider;
use App\Providers\SettingsServiceProvider;
use App\Providers\UpdatesServiceProvider;
use ArtisanPackUI\VisualEditorRendererBlade\VisualEditorRendererBladeServiceProvider;

return [
    AppServiceProvider::class,
    SettingsServiceProvider::class,
    DashboardWidgetServiceProvider::class,
    PerformanceServiceProvider::class,
    PrivacyServiceProvider::class,
    SeoIntegrationServiceProvider::class,
    UpdatesServiceProvider::class,
    // Sub-package of artisanpack-ui/visual-editor; its `extra.laravel.providers`
    // entry isn't auto-discovered because Composer only scans top-level packages.
    VisualEditorRendererBladeServiceProvider::class,
];
