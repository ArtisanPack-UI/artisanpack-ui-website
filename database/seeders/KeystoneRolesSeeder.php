<?php

declare(strict_types=1);

namespace Database\Seeders;

use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Seeds Keystone-specific roles on top of the cms-framework defaults.
 *
 * The framework ships `admin`, `editor`, and `user`. Keystone adds
 * `site_owner` — the client-side owner role between admin (Jacob) and
 * editor (client staff). See `plans/06-keystone-plan.md` §3.6.
 */
class KeystoneRolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name'        => 'Site Owner',
                'slug'        => 'site_owner',
                'description' => 'Client owner — manages all content, business info, and most settings (no themes, updater, or integrations).',
            ],
        ];

        foreach ($roles as $role) {
            Role::firstOrCreate(['slug' => $role['slug']], $role);
        }
    }
}
