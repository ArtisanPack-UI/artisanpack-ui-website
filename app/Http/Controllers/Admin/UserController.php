<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\Users\StoreUserRequest;
use App\Http\Requests\Admin\Users\UpdateUserRequest;
use App\Models\User;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use ArtisanPackUI\MediaLibrary\Models\Media;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-side user management.
 *
 * Site owners can invite editors; admins can manage every user. The role
 * matrix is enforced in {@see assignableRoles()} — site_owner only sees
 * `editor` in the role dropdown, never `admin` or another `site_owner`.
 */
class UserController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/users/Index', [
            'users' => User::with(['roles:id,slug,name', 'profilePhoto:id,file_path,disk,alt_text,title'])
                ->orderBy('display_name')
                ->get(['id', 'first_name', 'last_name', 'username', 'display_name', 'email', 'profile_photo_id'])
                ->map(fn (User $user) => [
                    'id'                => $user->id,
                    'username'          => $user->username,
                    'display_name'      => $user->display_name,
                    'email'             => $user->email,
                    'initials'          => $user->initials(),
                    'profile_photo_url' => $user->profilePhoto?->url() ?: null,
                    'roles'             => $user->roles->map(fn ($role) => [
                        'slug' => $role->slug,
                        'name' => $role->name,
                    ])->all(),
                ]),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('admin/users/Create', [
            'assignableRoles' => $this->assignableRoles($request),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $user = User::create([
            'first_name'       => $this->optionalString($validated['first_name'] ?? null),
            'last_name'        => $this->optionalString($validated['last_name'] ?? null),
            'username'         => Str::lower((string) $validated['username']),
            'nickname'         => $this->optionalString($validated['nickname'] ?? null),
            'display_name'     => (string) $validated['display_name'],
            'email'            => (string) $validated['email'],
            'password'         => Hash::make((string) $validated['password']),
            'profile_photo_id' => $validated['profile_photo_id'] ?? null,
        ]);

        $this->syncRoles($user, $validated['roles'] ?? []);

        return redirect()->route('admin.users.index')->with('success', 'User created.');
    }

    public function edit(Request $request, User $user): Response
    {
        $this->authorizeManageableTarget($request, $user);

        $user->loadMissing('profilePhoto');

        return Inertia::render('admin/users/Edit', [
            'user' => [
                'id'            => $user->id,
                'first_name'    => $user->first_name,
                'last_name'     => $user->last_name,
                'username'      => $user->username,
                'nickname'      => $user->nickname,
                'display_name'  => $user->display_name,
                'email'         => $user->email,
                'roles'         => $user->roles->pluck('slug')->all(),
                'profile_photo' => $this->profilePhotoPayload($user),
            ],
            'assignableRoles' => $this->assignableRoles($request),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $this->authorizeManageableTarget($request, $user);

        $validated = $request->validated();

        $user->fill([
            'first_name'       => $this->optionalString($validated['first_name'] ?? null),
            'last_name'        => $this->optionalString($validated['last_name'] ?? null),
            'username'         => Str::lower((string) $validated['username']),
            'nickname'         => $this->optionalString($validated['nickname'] ?? null),
            'display_name'     => (string) $validated['display_name'],
            'email'            => (string) $validated['email'],
            'profile_photo_id' => $validated['profile_photo_id'] ?? null,
        ]);

        if (! empty($validated['password'])) {
            $user->password = Hash::make((string) $validated['password']);
        }

        $user->save();

        $this->syncRoles($user, $validated['roles'] ?? []);

        return redirect()->route('admin.users.index')->with('success', 'User updated.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->authorizeManageableTarget($request, $user);

        if ($request->user()?->id === $user->id) {
            return redirect()->route('admin.users.index')->with('error', 'You cannot delete your own account.');
        }

        $user->delete();

        return redirect()->route('admin.users.index')->with('success', 'User deleted.');
    }

    /**
     * Roles the requester is allowed to assign. Admins can assign any role;
     * site_owners can only invite editors per the §3.6 matrix.
     *
     * @return array<int, array{slug: string, name: string}>
     */
    private function assignableRoles(Request $request): array
    {
        return Role::query()
            ->whereIn('slug', $this->assignableRoleSlugs($request))
            ->orderBy('name')
            ->get(['slug', 'name'])
            ->map(fn ($role) => ['slug' => $role->slug, 'name' => $role->name])
            ->all();
    }

    /**
     * @return list<string>
     */
    private function assignableRoleSlugs(Request $request): array
    {
        $user = $request->user();

        if ($user && $user->hasRole('admin')) {
            return Role::query()->pluck('slug')->all();
        }

        return ['editor'];
    }

    /**
     * Block site_owner (and lower) from acting on admin or site_owner accounts.
     * Admins always pass through; without this, a site_owner could strip an
     * admin's role or wipe the maintainer account.
     */
    private function authorizeManageableTarget(Request $request, User $target): void
    {
        $actor = $request->user();

        if (null === $actor || $actor->hasRole('admin')) {
            return;
        }

        $isPrivilegedTarget = $target->roles()
            ->whereIn('slug', ['admin', 'site_owner'])
            ->exists();

        abort_if($isPrivilegedTarget, 403);
    }

    /**
     * @param  array<int, string>  $slugs
     */
    private function syncRoles(User $user, array $slugs): void
    {
        $ids = Role::query()->whereIn('slug', $slugs)->pluck('id')->all();
        $user->roles()->sync($ids);
    }

    /**
     * Shape the user's profile photo for the admin edit screen. Mirrors the
     * subset of the media-library `Media` resource that the
     * `<FeaturedImagePicker>` UI cares about; returns null when no photo is
     * set so the React layer can fall back to the initials avatar.
     *
     * @return array{id: int, url: string, title: string|null, alt_text: string|null, mime_type: string}|null
     */
    private function profilePhotoPayload(User $user): ?array
    {
        $media = $user->profilePhoto;

        if (! $media instanceof Media) {
            return null;
        }

        return [
            'id'        => (int) $media->id,
            'url'       => (string) $media->url(),
            'title'     => $media->title,
            'alt_text'  => $media->alt_text,
            'mime_type' => (string) $media->mime_type,
        ];
    }

    /**
     * Normalize a free-text request field into `string|null`. Empty and
     * whitespace-only values collapse to null so the database stores absence
     * consistently instead of mixing `null` and `""`.
     */
    private function optionalString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return '' !== $trimmed ? $trimmed : null;
    }
}
