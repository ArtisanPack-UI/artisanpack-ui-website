<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\User;
use App\Models\UserEditorPreference;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserEditorPreference>
 */
class UserEditorPreferenceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id'          => User::factory(),
            'post_type'        => 'posts',
            'panel_order'      => [],
            'collapsed_panels' => [],
            'hidden_panels'    => [],
        ];
    }

    /**
     * Preferences scoped to a specific post type (`posts`, `pages`, or a
     * CPT slug).
     */
    public function forPostType(string $postType): static
    {
        return $this->state(fn (array $attributes): array => [
            'post_type' => $postType,
        ]);
    }

    /**
     * Start with the given panels hidden.
     *
     * @param  list<string>  $panels
     */
    public function hiding(array $panels): static
    {
        return $this->state(fn (array $attributes): array => [
            'hidden_panels' => $panels,
        ]);
    }

    /**
     * Start with the given panels collapsed.
     *
     * @param  list<string>  $panels
     */
    public function collapsing(array $panels): static
    {
        return $this->state(fn (array $attributes): array => [
            'collapsed_panels' => $panels,
        ]);
    }

    /**
     * Start with an explicit two-column panel order.
     *
     * @param  list<string>  $main
     * @param  list<string>  $sidebar
     */
    public function ordered(array $main, array $sidebar): static
    {
        return $this->state(fn (array $attributes): array => [
            'panel_order' => ['main' => $main, 'sidebar' => $sidebar],
        ]);
    }
}
