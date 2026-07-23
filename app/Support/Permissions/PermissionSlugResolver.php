<?php

declare(strict_types=1);

namespace App\Support\Permissions;

use App\Models\User;

/**
 * Flatten a user's effective permission slugs across all assigned roles
 * (including the full ancestor chain). Shared by
 * {@see \App\Http\Middleware\HandleInertiaRequests} and
 * {@see \App\Support\AdminMenu\AdminMenuBuilder} so both sides agree on
 * what a viewer holds — mismatched slug sets would let the sidebar show
 * items a controller would 403 the click on.
 */
class PermissionSlugResolver
{
    /**
     * @return list<string>
     */
    public function slugsFor(User $user): array
    {
        $user->roles->loadMissing('permissions');

        $slugs   = [];
        $visited = [];

        foreach ($user->roles as $role) {
            $this->collectFromRoleChain($role, $slugs, $visited);
        }

        return array_values(array_unique($slugs));
    }

    /**
     * Walk the parent chain iteratively and lazy-load `permissions` +
     * `parent` per level only as needed, so a 5-deep role hierarchy
     * doesn't quietly issue five separate lazy queries per role at the
     * bottom — Eloquent's `loadMissing('parent.permissions')` on the
     * roles collection only reaches the immediate parent.
     *
     * @param  list<string>  $slugs
     * @param  array<int, bool>  $visited
     */
    private function collectFromRoleChain(object $role, array &$slugs, array &$visited): void
    {
        $current = $role;

        while (null !== $current) {
            $key = $current->getKey();
            if (isset($visited[$key])) {
                return;
            }
            $visited[$key] = true;

            $current->loadMissing('permissions');
            foreach ($current->permissions as $permission) {
                $slugs[] = $permission->slug;
            }

            $current->loadMissing('parent');
            $current = $current->parent;
        }
    }
}
