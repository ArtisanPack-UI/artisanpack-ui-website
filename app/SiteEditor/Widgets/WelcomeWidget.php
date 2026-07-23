<?php

declare(strict_types=1);

namespace App\SiteEditor\Widgets;

use App\Models\User;
use App\SiteEditor\Widgets\Contracts\KeystoneAdminWidgetInterface;

/**
 * "Welcome / quick actions" — greets the operator by display name with the
 * configured site title above a fixed shortcut bar (Create page, Write
 * post, Upload media, Customize site).
 *
 * The action list is intentionally hardcoded for v1 — there is no settings
 * schema yet; tailoring will land alongside per-user pinned actions in a
 * later sub-issue of #71.
 */
class WelcomeWidget implements KeystoneAdminWidgetInterface
{
    /**
     * @return array{title: string, description: string}
     */
    public static function getWidgetInfo(): array
    {
        return [
            'title'       => 'Welcome',
            'description' => 'Greeting plus quick links to create content and customize the site.',
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     *
     * @return array{site_name: string, display_name: string, actions: list<array{key: string, label: string, url: string}>}
     */
    public static function getData(User $user, array $options): array
    {
        return [
            'site_name'    => self::resolveSiteName(),
            'display_name' => (string) ($user->display_name ?? ''),
            'actions'      => [
                ['key' => 'create-page',    'label' => 'Create page',    'url' => route('admin.pages.create')],
                ['key' => 'write-post',     'label' => 'Write post',     'url' => route('admin.posts.create')],
                ['key' => 'upload-media',   'label' => 'Upload media',   'url' => route('admin.media.index')],
                ['key' => 'customize-site', 'label' => 'Customize site', 'url' => route('admin.site-design')],
            ],
        ];
    }

    /**
     * @return array{component: string, default_grid_config: array<string, array{rows: int, cols: int}>}
     */
    public static function extendedInfo(): array
    {
        return [
            'component'           => 'WelcomeWidget',
            'default_grid_config' => [
                'sm' => ['rows' => 2, 'cols' => 12],
                'md' => ['rows' => 2, 'cols' => 12],
                'lg' => ['rows' => 1, 'cols' => 12],
                'xl' => ['rows' => 1, 'cols' => 8],
            ],
        ];
    }

    /**
     * Resolve the public-facing site name, falling back to the application
     * name (which itself may be overridden from `site.title` at boot — see
     * `SettingsServiceProvider::applySiteName`).
     */
    private static function resolveSiteName(): string
    {
        $title = apGetSetting('site.title');

        if (is_string($title) && '' !== trim($title)) {
            return $title;
        }

        return (string) config('app.name', 'Keystone');
    }
}
