<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\Users;

use App\Http\Requests\Concerns\NormalizesUsername;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for `POST /admin/users`. Field rules mirror the WordPress-style
 * user profile model: split name parts (optional), unique case-insensitive
 * username, free-form nickname, persisted `display_name`, optional profile
 * photo via media-library, and the requester's assignable role slugs.
 */
class StoreUserRequest extends FormRequest
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
        return [
            'first_name'       => ['nullable', 'string', 'max:255'],
            'last_name'        => ['nullable', 'string', 'max:255'],
            'username'         => [
                'required',
                'string',
                'min:3',
                'max:60',
                'regex:/^[a-z0-9._-]+$/',
                Rule::unique('users', 'username'),
            ],
            'nickname'         => ['nullable', 'string', 'max:255'],
            'display_name'     => ['required', 'string', 'max:255'],
            'email'            => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password'         => ['required', 'string', 'min:8'],
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
     * Resolve the role slugs the requester is allowed to assign. Mirrors the
     * authorization matrix on {@see \App\Http\Controllers\Admin\UserController}:
     * admins may pick any role, everyone else may only invite editors.
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
}
