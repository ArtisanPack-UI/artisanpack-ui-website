<?php

declare(strict_types=1);

namespace Modules\Auth\Http\Requests;

use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Fallback max login attempts when `security.loginAttempts` is unset or invalid.
     */
    private const DEFAULT_LOGIN_ATTEMPTS = 5;

    /**
     * Fallback lockout window in seconds when `security.loginTimeout` is unset or invalid.
     */
    private const DEFAULT_LOGIN_TIMEOUT = 120;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'login'    => ['required', 'string'],
            'password' => ['required', 'string'],
        ];
    }

    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $login       = $this->normalizedLogin();
        $credentials = [
            $this->loginField($login) => $login,
            'password'                => $this->string('password')->toString(),
        ];

        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey(), $this->lockoutSeconds());

            throw ValidationException::withMessages([
                'login' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), $this->maxAttempts())) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'login' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->normalizedLogin()).'|'.$this->ip());
    }

    /**
     * Resolve which user column the submitted `login` value targets. Values
     * containing `@` are treated as emails (matching `users.email`), everything
     * else is treated as a username (matching `users.username`). The
     * application-level username validator already excludes `@`, so there's no
     * overlap.
     */
    private function loginField(string $login): string
    {
        return Str::contains($login, '@') ? 'email' : 'username';
    }

    /**
     * The submitted `login` value with surrounding whitespace stripped. Used as
     * the single source of truth for both `Auth::attempt()` credentials and the
     * throttle-key so leading/trailing spaces never split rate-limit buckets
     * from the actual auth attempt.
     */
    private function normalizedLogin(): string
    {
        return trim($this->string('login')->toString());
    }

    /**
     * The configured `security.loginAttempts` threshold, falling back to
     * {@see self::DEFAULT_LOGIN_ATTEMPTS} when unset or non-positive.
     */
    private function maxAttempts(): int
    {
        return $this->positiveIntSetting('security.loginAttempts', self::DEFAULT_LOGIN_ATTEMPTS);
    }

    /**
     * The configured `security.loginTimeout` lockout window in seconds, falling
     * back to {@see self::DEFAULT_LOGIN_TIMEOUT} when unset or non-positive.
     */
    private function lockoutSeconds(): int
    {
        return $this->positiveIntSetting('security.loginTimeout', self::DEFAULT_LOGIN_TIMEOUT);
    }

    /**
     * Read a stored setting as a positive integer, returning the fallback when
     * the value is missing, non-numeric, or not greater than zero.
     */
    private function positiveIntSetting(string $key, int $fallback): int
    {
        $value = app(SettingsManager::class)->getSetting($key);

        if (! is_numeric($value)) {
            return $fallback;
        }

        $value = (int) $value;

        return $value > 0 ? $value : $fallback;
    }
}
