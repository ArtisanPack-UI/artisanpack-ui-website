<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for the `/install` web wizard. Mirrors the inputs that the
 * `keystone:install` CLI command collects so both surfaces drop into the
 * same {@see \App\Installer\InstallationService} without forking the
 * required-field contract.
 */
class InstallRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The `installed:guard` middleware already enforced flag-absence,
        // token match, and IP allowlist before we reached this request.
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'site_type'          => ['required', 'string', 'in:sbdf_pro,custom_crafted'],
            'business_name'      => ['required', 'string', 'max:255'],
            'primary_domain'     => ['required', 'string', 'max:255'],
            'admin_name'         => ['required', 'string', 'max:255'],
            'admin_email'        => ['required', 'string', 'email', 'max:255'],
            'admin_password'     => ['nullable', 'string', 'min:8', 'max:255'],
            'site_owner_email'   => ['nullable', 'string', 'email', 'max:255'],
            'theme_zip_path'     => ['nullable', 'string', 'max:1024'],
            'cloudflare_zone_id' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * Treat empty strings on optional fields as null so the wizard's "skip"
     * UX (a blank input) doesn't trip `min:8` on the admin password or
     * `email` on the optional site-owner email.
     */
    protected function prepareForValidation(): void
    {
        $optional = [
            'admin_password',
            'site_owner_email',
            'theme_zip_path',
            'cloudflare_zone_id',
        ];

        $normalized = [];

        foreach ($optional as $field) {
            $value = $this->input($field);

            // Only coerce blank strings to null. A non-string payload
            // (e.g. `?admin_password[]=foo`) falls through to validation,
            // where the `string` rule will reject it — `(string) $array`
            // would have raised an "Array to string conversion" warning
            // before we ever got there.
            if (is_string($value) && '' === trim($value)) {
                $normalized[$field] = null;
            }
        }

        if ([] !== $normalized) {
            $this->merge($normalized);
        }
    }
}
