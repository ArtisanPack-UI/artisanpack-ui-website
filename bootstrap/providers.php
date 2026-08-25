<?php

use App\Providers\AppServiceProvider;
use App\Providers\SettingsServiceProvider;
use ArtisanPackUI\VisualEditorRendererBlade\VisualEditorRendererBladeServiceProvider;

return [
    AppServiceProvider::class,
    SettingsServiceProvider::class,
    // Performance, Privacy, Seo and Updater are registered by nwidart from
    // their Modules/<Name>/module.json manifests, as is
    // `DashboardWidgetServiceProvider` — it moved into the SiteEditor module
    // (#215) and is now registered by `SiteEditorServiceProvider`.
    // Sub-package of artisanpack-ui/visual-editor; its `extra.laravel.providers`
    // entry isn't auto-discovered because Composer only scans top-level packages.
    VisualEditorRendererBladeServiceProvider::class,
];
