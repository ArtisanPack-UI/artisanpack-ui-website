<?php

declare(strict_types=1);

namespace App\Http\Requests\Concerns;

use Illuminate\Support\Str;

/**
 * Normalizes the inbound `username` field before validation runs.
 *
 * Trims surrounding whitespace and lower-cases the value so the case-insensitive
 * uniqueness rule (`Rule::unique('users','username')`) and the lowercase-only
 * regex see the same string the controllers persist. Without this, a request
 * submitting `JaneDoe` would pass uniqueness against `janedoe`, then collide
 * on insert once the controller lower-cased it.
 *
 * Used by every FormRequest that accepts a `username` field — admin Store /
 * Update, public Register, and self-service Profile updates.
 */
trait NormalizesUsername
{
    /**
     * Mutate the input bag before validation. Called automatically by
     * {@see \Illuminate\Foundation\Http\FormRequest}.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->has('username')) {
            return;
        }

        // Only normalize when the input is actually a string. Coercing arrays
        // or other shapes into "Array" / "1" here would mask invalid payload
        // types and let them slip past the downstream `string` validator.
        $username = $this->input('username');

        if (! is_string($username)) {
            return;
        }

        $this->merge([
            'username' => Str::lower(trim($username)),
        ]);
    }
}
