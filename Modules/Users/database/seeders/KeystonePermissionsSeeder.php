<?php

declare(strict_types=1);

namespace Modules\Users\Database\Seeders;

use ArtisanPackUI\CMSFramework\Modules\Users\Models\Permission;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Seeds Keystone-specific permission slugs and binds them to the three
 * Keystone roles (`admin`, `site_owner`, `editor`).
 *
 * The cms-framework default seeder ships coarse-grained slugs
 * (`manage-content`, `manage-themes`, etc.); Keystone needs the finer
 * dotted slugs called out in `plans/06-keystone-plan.md` §3.6 so admin
 * UI checks line up with the role matrix in the same section.
 *
 * Permission `name` carries a unique constraint upstream, so Keystone's
 * display names for slugs that exist in both seeders (`themes.manage` vs
 * the framework's `manage-themes`, `settings.manage` vs `manage-settings`)
 * are suffixed with ` (Keystone)` to avoid a UniqueConstraintViolation
 * during `migrate --seed`.
 *
 * Non-destructive on re-run: uses `firstOrCreate()` for permissions and
 * `syncWithoutDetaching()` for role assignments so consumer-level
 * customizations are preserved.
 */
class KeystonePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->permissions() as $permission) {
            Permission::firstOrCreate(['slug' => $permission['slug']], $permission);
        }

        $this->assignPermissionsToRoles();
    }

    /**
     * Keystone-specific permission catalog.
     *
     * @return array<int, array{name: string, slug: string, description: string}>
     */
    protected function permissions(): array
    {
        return [
            [
                'name'        => 'Manage Themes (Keystone)',
                'slug'        => 'themes.manage',
                'description' => 'Upload, validate, and activate themes.',
            ],
            [
                'name'        => 'Run Updater',
                'slug'        => 'updater.run',
                'description' => 'Check for and install application updates.',
            ],
            [
                'name'        => 'Manage Integrations',
                'slug'        => 'integrations.manage',
                'description' => 'Configure third-party integrations.',
            ],
            [
                'name'        => 'Manage Settings (Keystone)',
                'slug'        => 'settings.manage',
                'description' => 'View and update site, brand, SEO, notification, and developer settings.',
            ],
            [
                'name'        => 'Edit Business Info',
                'slug'        => 'business-info.edit',
                'description' => 'Edit the site\'s business information (hours, phone, email, etc.).',
            ],
            [
                'name'        => 'Invite Users',
                'slug'        => 'users.invite',
                'description' => 'Invite additional users to the admin.',
            ],
            [
                'name'        => 'Draft Pages',
                'slug'        => 'pages.draft',
                'description' => 'Create and edit page drafts.',
            ],
            [
                'name'        => 'Publish Pages',
                'slug'        => 'pages.publish',
                'description' => 'Publish and unpublish pages.',
            ],
            [
                'name'        => 'View Media',
                'slug'        => 'media.view',
                'description' => 'Browse and view media library items.',
            ],
            [
                'name'        => 'Upload Media',
                'slug'        => 'media.upload',
                'description' => 'Upload new media items to the library.',
            ],
            [
                'name'        => 'Edit Media',
                'slug'        => 'media.edit',
                'description' => 'Edit media metadata (title, alt text, caption).',
            ],
            [
                'name'        => 'Delete Media',
                'slug'        => 'media.delete',
                'description' => 'Delete media items from the library.',
            ],
            [
                'name'        => 'View Performance Dashboards',
                'slug'        => 'performance.view',
                'description' => 'Read the RUM dashboard, slow query log, index suggestions, and cache management surfaces under /admin/performance.',
            ],
        ];
    }

    protected function assignPermissionsToRoles(): void
    {
        $admin = Role::where('slug', 'admin')->first();
        if ($admin) {
            $admin->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', $this->keystonePermissionSlugs())->pluck('id')->all(),
            );
        }

        $siteOwner = Role::where('slug', 'site_owner')->first();
        if ($siteOwner) {
            $siteOwner->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', [
                    'business-info.edit',
                    'settings.manage',
                    'users.invite',
                    'pages.draft',
                    'pages.publish',
                    'media.view',
                    'media.upload',
                    'media.edit',
                    'media.delete',
                    // Performance dashboards expose per-page traffic
                    // and slow query text — site owners get read
                    // access; editors don't need it for their
                    // day-to-day authoring flow.
                    'performance.view',
                ])->pluck('id')->all(),
            );
        }

        $editor = Role::where('slug', 'editor')->first();
        if ($editor) {
            $editor->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', [
                    'pages.draft',
                    'media.view',
                    'media.upload',
                    'media.edit',
                    'media.delete',
                ])->pluck('id')->all(),
            );
        }
    }

    /**
     * @return list<string>
     */
    protected function keystonePermissionSlugs(): array
    {
        return array_column($this->permissions(), 'slug');
    }
}
