<?php

declare(strict_types=1);

namespace Modules\Users\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Users\Models\User;
use Modules\Users\Models\UserEditorPreference;

/**
 * @extends Factory<UserEditorPreference>
 */
class UserEditorPreferenceFactory extends Factory
{
    /**
     * The model this factory builds.
     *
     * Stated for the same reason as {@see UserFactory::$model} — the
     * guesser only resolves factories living under the root
     * `Database\Factories` namespace.
     *
     * @var class-string<UserEditorPreference>
     */
    protected $model = UserEditorPreference::class;

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
            'view_mode'        => 'normal',
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

    /**
     * Start in a specific editor chrome view mode (`normal`, `full-width`,
     * or `distraction-free`).
     */
    public function withViewMode(string $mode): static
    {
        return $this->state(fn (array $attributes): array => [
            'view_mode' => $mode,
        ]);
    }
}
