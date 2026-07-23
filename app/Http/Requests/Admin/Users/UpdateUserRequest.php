<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Users;

use App\Http\Requests\Concerns\NormalizesUsername;
use App\Models\User;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for `PUT /admin/users/{user}`. Mirrors {@see StoreUserRequest}
 * but allows an empty `password` (keep current), and ignores the target
 * user's own row when enforcing the unique constraints on `username` and
 * `email` so renames don't clash with themselves.
 */
class UpdateUserRequest extends FormRequest
{
    use NormalizesUsername;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $userId = $this->targetUserId();

        return [
            'first_name'       => ['nullable', 'string', 'max:255'],
            'last_name'        => ['nullable', 'string', 'max:255'],
            'username'         => [
                'required',
                'string',
                'min:3',
                'max:60',
                'regex:/^[a-z0-9._-]+$/',
                Rule::unique('users', 'username')->ignore($userId),
            ],
            'nickname'         => ['nullable', 'string', 'max:255'],
            'display_name'     => ['required', 'string', 'max:255'],
            'email'            => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password'         => ['nullable', 'string', 'min:8'],
            'profile_photo_id' => [
                'nullable',
                'integer',
                Rule::exists('media', 'id')->where(fn ($q) => $q->where('mime_type', 'like', 'image/%')),
            ],
            'roles'            => ['array'],
            'roles.*'          => ['string', Rule::in($this->assignableRoleSlugs())],
        ];
    }

    /**
     * Resolve the role slugs the requester is allowed to assign — see
     * {@see StoreUserRequest::assignableRoleSlugs()}.
     *
     * @return list<string>
     */
    public function assignableRoleSlugs(): array
    {
        $user = $this->user();

        if (null !== $user && $user->hasRole('admin')) {
            return Role::query()->pluck('slug')->all();
        }

        return ['editor'];
    }

    /**
     * The id of the route-bound user being updated, used to scope the
     * unique-ignore on `username` and `email`. Returns null if the route is
     * not bound to a {@see User} (in which case the rules behave like a fresh
     * create, which is the safer default).
     */
    private function targetUserId(): ?int
    {
        $route = $this->route('user');

        return $route instanceof User ? $route->id : null;
    }
}
