<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $firstName = fake()->firstName();
        $lastName  = fake()->lastName();

        return [
            'first_name'        => $firstName,
            'last_name'         => $lastName,
            'username'          => $this->generateUsername($firstName, $lastName),
            'nickname'          => null,
            'display_name'      => $firstName.' '.$lastName,
            'email'             => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password'          => static::$password ??= Hash::make('password'),
            'remember_token'    => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /**
     * Build a username that satisfies the same constraints the application's
     * FormRequests enforce: lowercase, `[a-z0-9._-]` only, and `max:60`. Faker's
     * `firstName()` / `lastName()` produce characters outside that set
     * (accents, apostrophes), so strip them first, fall back to `user` when the
     * sanitized base is empty, and reserve the unique numeric suffix's space
     * before truncating so factories never collide on the cap.
     */
    private function generateUsername(string $firstName, string $lastName): string
    {
        $suffix = (string) fake()->unique()->numberBetween(1, 99999);

        $base = Str::of($firstName.'.'.$lastName)
            ->lower()
            ->replaceMatches('/[^a-z0-9._-]+/', '')
            ->trim('.-_')
            ->toString();

        if ('' === $base) {
            $base = 'user';
        }

        $maxBaseLength = 60 - strlen($suffix);

        return Str::substr($base, 0, max(1, $maxBaseLength)).$suffix;
    }
}
