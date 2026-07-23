<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Permission;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-only permission listing. Permissions are seeded from
 * {@see \Database\Seeders\KeystonePermissionsSeeder}; the UI here is
 * read-only because the slug catalog is a code-level contract.
 */
class PermissionController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/permissions/Index', [
            'permissions' => Permission::query()
                ->with('roles:id,slug,name')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'description'])
                ->map(fn (Permission $permission) => [
                    'id'          => $permission->id,
                    'name'        => $permission->name,
                    'slug'        => $permission->slug,
                    'description' => $permission->description,
                    'roles'       => $permission->roles->map(fn ($role) => [
                        'slug' => $role->slug,
                        'name' => $role->name,
                    ])->all(),
                ]),
        ]);
    }
}
