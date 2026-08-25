<?php

declare(strict_types=1);

namespace Modules\Installer\Support;

use Modules\Users\Models\User;

/**
 * Per-step outcomes recorded by
 * {@see \Modules\Installer\Services\InstallationService}. Steps are added in
 * the order they ran so the CLI command can stream them as a checklist.
 */
class InstallationReport
{
    /**
     * @var list<array{step: string, status: string, detail: ?string}>
     */
    public array $steps = [];

    public ?User $adminUser = null;

    public ?string $adminPassword = null;

    public function step(string $name, string $status, ?string $detail = null): void
    {
        $this->steps[] = [
            'step'   => $name,
            'status' => $status,
            'detail' => $detail,
        ];
    }

    /**
     * @return list<string>
     */
    public function failedSteps(): array
    {
        return array_values(array_map(
            fn (array $step): string => $step['step'],
            array_filter($this->steps, fn (array $step): bool => 'failed' === $step['status']),
        ));
    }

    public function hasFailures(): bool
    {
        return [] !== $this->failedSteps();
    }
}
