<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use App\Http\Requests\Concerns\NormalizesUsername;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules;

/**
 * Validation for the public registration endpoint. Mirrors the admin Store
 * request shape (split first/last name, unique case-insensitive username,
 * required email) so a new self-service signup lands on the same identity
 * model as an admin-invited user, plus enforces the application password
 * defaults via {@see Rules\Password::defaults()}.
 */
class RegisterRequest extends FormRequest
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
            'first_name' => ['required', 'string', 'max:255'],
            'last_name'  => ['nullable', 'string', 'max:255'],
            'username'   => [
                'required',
                'string',
                'min:3',
                'max:60',
                'regex:/^[a-z0-9._-]+$/',
                'unique:'.User::class.',username',
            ],
            'email'      => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password'   => ['required', 'confirmed', Rules\Password::defaults()],
        ];
    }
}
