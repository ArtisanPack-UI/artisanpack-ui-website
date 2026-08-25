<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Modules\SiteEditor\Models\Dashboard;
use Modules\Users\Models\User;

/**
 * @extends Factory<Dashboard>
 */
class DashboardFactory extends Factory
{
    /**
     * The model this factory builds.
     *
     * Stated explicitly because the factory no longer lives under the root
     * `Database\Factories` namespace: Laravel's model guesser strips
     * `Database\Factories\` off the factory's FQCN and looks the remainder up
     * under `App\Models`, which resolves to nothing for a module-namespaced
     * factory. See `newFactory()` on {@see Dashboard} for the mirror of this
     * on the model side.
     *
     * @var class-string<Dashboard>
     */
    protected $model = Dashboard::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'user_id'    => User::factory(),
            'name'       => Str::title($name),
            'slug'       => Str::slug($name),
            'is_default' => false,
            'position'   => 0,
            'widgets'    => [],
        ];
    }

    /**
     * The default "Overview" dashboard that `UserDashboardService` seeds for
     * new users — empty widget list, `is_default = true`, slug `overview`.
     */
    public function overview(): static
    {
        return $this->state(fn (array $attributes): array => [
            'name'       => 'Overview',
            'slug'       => 'overview',
            'is_default' => true,
            'position'   => 0,
            'widgets'    => [],
        ]);
    }

    /**
     * Mark this dashboard as the user's default.
     */
    public function default(): static
    {
        return $this->state(fn (array $attributes): array => [
            'is_default' => true,
        ]);
    }

    /**
     * Place this dashboard at a specific position in the user's switcher.
     */
    public function atPosition(int $position): static
    {
        return $this->state(fn (array $attributes): array => [
            'position' => $position,
        ]);
    }

    /**
     * Seed the dashboard with the given list of widget-instance arrays. Pass
     * an array of widget shapes (as produced by the framework's
     * `AdminWidgetManager::createWidget()` or whatever the test needs).
     *
     * @param  list<array<string, mixed>>  $widgets
     */
    public function withWidgets(array $widgets): static
    {
        return $this->state(fn (array $attributes): array => [
            'widgets' => $widgets,
        ]);
    }
}
