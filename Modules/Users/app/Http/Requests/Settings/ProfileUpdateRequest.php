<?php

declare(strict_types=1);

namespace Modules\Users\Http\Requests\Settings;

use App\Http\Requests\Concerns\NormalizesUsername;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Media\Support\ImageMediaRule;
use Modules\Users\Models\User;

/**
 * Validation for the self-service Profile Settings page
 * (`PATCH /admin/profile`). Mirrors the admin `UpdateUserRequest` for the
 * identity fields and profile-photo media, while ignoring the requester's own
 * row on the `username` and `email` unique constraints. Role assignments and
 * password changes are intentionally excluded here — those live on the
 * Password Settings page and the admin Users CRUD respectively.
 */
class ProfileUpdateRequest extends FormRequest
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
        // The route is behind the auth middleware so `$this->user()` is always
        // present by the time validation runs — fail loudly otherwise rather
        // than silently letting the ignore() rule see null and match nothing.
        $userId = $this->user()->id;

        return [
            'first_name'       => ['nullable', 'string', 'max:255'],
            'last_name'        => ['nullable', 'string', 'max:255'],
            'username'         => [
                'required',
                'string',
                'min:3',
                'max:60',
                'regex:/^[a-z0-9._-]+$/',
                Rule::unique(User::class, 'username')->ignore($userId),
            ],
            'nickname'         => ['nullable', 'string', 'max:255'],
            'display_name'     => ['required', 'string', 'max:255'],
            'email'            => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                Rule::unique(User::class)->ignore($userId),
            ],
            'profile_photo_id' => ImageMediaRule::nullable(),
        ];
    }
}
