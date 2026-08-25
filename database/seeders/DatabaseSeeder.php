<?php

declare(strict_types=1);

namespace Database\Seeders;

use ArtisanPackUI\Database\Seeders\PermissionsTableSeeder;
use ArtisanPackUI\Database\Seeders\RolesTableSeeder;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Modules\Users\Database\Seeders\KeystonePermissionsSeeder;
use Modules\Users\Database\Seeders\KeystoneRolesSeeder;
use Modules\Users\Models\User;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolesTableSeeder::class,
            KeystoneRolesSeeder::class,
            PermissionsTableSeeder::class,
            KeystonePermissionsSeeder::class,
        ]);

        // User::factory(10)->create();

        User::factory()->create([
            'first_name'   => 'Test',
            'last_name'    => 'User',
            'username'     => 'testuser',
            'display_name' => 'Test User',
            'email'        => 'test@example.com',
        ]);
    }
}
