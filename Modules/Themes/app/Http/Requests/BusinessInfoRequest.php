<?php

declare(strict_types=1);

namespace Modules\Themes\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the partial-update payload for the Site Design > Business
 * Info panel. Every field is `sometimes` so an admin can save a single
 * change (e.g. just the phone number) without re-submitting every other
 * key.
 *
 * Days of the week are validated against the canonical list registered
 * in {@see \App\Providers\SettingsServiceProvider::defaultGlobalHours()}
 * so unknown keys can't sneak into the stored JSON.
 */
class BusinessInfoRequest extends FormRequest
{
    private const HOURS_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    /**
     * Authorization is delegated to the controller's policy check.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $rules = [
            'business_name'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'phone'                => ['sometimes', 'nullable', 'string', 'max:50'],
            'email'                => ['sometimes', 'nullable', 'email', 'max:255'],

            'address'              => ['sometimes', 'array'],
            'address.street'       => ['sometimes', 'nullable', 'string', 'max:255'],
            'address.city'         => ['sometimes', 'nullable', 'string', 'max:255'],
            'address.state'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'address.postal_code'  => ['sometimes', 'nullable', 'string', 'max:32'],
            'address.country'      => ['sometimes', 'nullable', 'string', 'max:255'],

            'hours'                => ['sometimes', 'array'],

            'social_links'            => ['sometimes', 'array'],
            'social_links.*'          => ['array'],
            // Both fields are nullable so a freshly-added (still-empty) row
            // doesn't fire a validation error before the user has typed
            // anything. The both-or-neither pairing is enforced in
            // withValidator() so a half-filled row surfaces a clear
            // field-level error instead of being silently dropped by the
            // sanitizer.
            'social_links.*.platform' => ['nullable', 'string', 'max:64'],
            'social_links.*.url'      => ['nullable', 'url', 'max:2048'],
        ];

        foreach (self::HOURS_DAYS as $day) {
            $rules["hours.{$day}"]          = ['sometimes', 'array'];
            $rules["hours.{$day}.open"]     = ['sometimes', 'nullable', 'string', 'max:8'];
            $rules["hours.{$day}.close"]    = ['sometimes', 'nullable', 'string', 'max:8'];
            $rules["hours.{$day}.closed"]   = ['sometimes', 'boolean'];
        }

        return $rules;
    }

    /**
     * Reject half-filled social-link rows so the user sees a clear error
     * on the missing field rather than having the sanitizer silently
     * drop the row after save.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $links = $this->input('social_links');

            if (! is_array($links)) {
                return;
            }

            foreach ($links as $index => $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                $platform = trim((string) ($entry['platform'] ?? ''));
                $url      = trim((string) ($entry['url'] ?? ''));

                if ('' === $platform && '' !== $url) {
                    $validator->errors()->add("social_links.{$index}.platform", __('A platform is required when a URL is set.'));
                }

                if ('' !== $platform && '' === $url) {
                    $validator->errors()->add("social_links.{$index}.url", __('A URL is required when a platform is set.'));
                }
            }
        });
    }
}
