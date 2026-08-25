<?php

declare(strict_types=1);

namespace Modules\Users\Http\Controllers;

use App\Http\Controllers\Controller;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Permission;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-only role management. Sits on top of the cms-framework Role model;
 * persists slugs + permission assignments through the rbac base.
 */
class RoleController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/roles/Index', [
            'roles' => Role::with('permissions:id,slug')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'description'])
                ->map(fn (Role $role) => [
                    'id'                => $role->id,
                    'name'              => $role->name,
                    'slug'              => $role->slug,
                    'description'       => $role->description,
                    'permission_count'  => $role->permissions->count(),
                ]),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('admin/roles/Create', [
            'permissions' => $this->permissionOptions(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255', 'unique:roles,name'],
            'slug'          => ['nullable', 'string', 'max:255', 'unique:roles,slug'],
            'description'   => ['nullable', 'string', 'max:255'],
            'permissions'   => ['array'],
            'permissions.*' => ['string', 'exists:permissions,slug'],
        ]);

        $role = Role::create([
            'name'        => $validated['name'],
            'slug'        => $validated['slug'] ?? null ?: Str::slug($validated['name'], '_'),
            'description' => $validated['description'] ?? null,
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        return redirect()->route('admin.roles.index')->with('success', 'Role created.');
    }

    public function edit(Role $role): Response
    {
        return Inertia::render('admin/roles/Edit', [
            'role' => [
                'id'          => $role->id,
                'name'        => $role->name,
                'slug'        => $role->slug,
                'description' => $role->description,
                'permissions' => $role->permissions->pluck('slug')->all(),
            ],
            'permissions' => $this->permissionOptions(),
        ]);
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $isBuiltIn = in_array($role->slug, ['admin', 'site_owner', 'editor'], true);

        $validated = $request->validate([
            'name'          => ['required', 'string', 'max:255', Rule::unique('roles', 'name')->ignore($role->id)],
            'slug'          => ['required', 'string', 'max:255', Rule::unique('roles', 'slug')->ignore($role->id)],
            'description'   => ['nullable', 'string', 'max:255'],
            'permissions'   => ['array'],
            'permissions.*' => ['string', 'exists:permissions,slug'],
        ]);

        // Built-in slugs are part of the authorization contract (route
        // middleware, destroy guard, controller checks). Mutating them
        // would silently bypass those gates.
        if ($isBuiltIn && $validated['slug'] !== $role->slug) {
            return back()->withErrors(['slug' => 'Built-in role slugs cannot be changed.']);
        }

        $role->update([
            'name'        => $validated['name'],
            'slug'        => $validated['slug'],
            'description' => $validated['description'] ?? null,
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        return redirect()->route('admin.roles.index')->with('success', 'Role updated.');
    }

    public function destroy(Role $role): RedirectResponse
    {
        if (in_array($role->slug, ['admin', 'site_owner', 'editor'], true)) {
            return redirect()->route('admin.roles.index')->with('error', 'Built-in roles cannot be deleted.');
        }

        $role->delete();

        return redirect()->route('admin.roles.index')->with('success', 'Role deleted.');
    }

    /**
     * @return array<int, array{slug: string, name: string}>
     */
    private function permissionOptions(): array
    {
        return Permission::query()
            ->orderBy('name')
            ->get(['slug', 'name'])
            ->map(fn ($permission) => ['slug' => $permission->slug, 'name' => $permission->name])
            ->all();
    }
}
