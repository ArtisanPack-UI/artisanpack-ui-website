<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Support\Facades\File;

use function Laravel\Prompts\multiselect;

/**
 * Installs the optional ArtisanPack UI packages and scaffolds the ArtisanPack
 * config, both of which a fresh checkout may or may not want.
 *
 * This command deliberately does **not** offer to set up a modular Laravel
 * structure any more. It used to (install `nwidart/laravel-modules`, add the
 * merge-plugin block to composer.json, `module:make Admin Auth Users`), but
 * Keystone now ships the modular layout as its real structure — 16 modules
 * under `Modules/`, the merge-plugin block already in composer.json, and
 * `plans/14-modular-laravel-setup.md` §3 as the reference. Re-running that
 * branch on this repo would reinstall a present dependency and scaffold empty
 * modules over the real ones, so it was removed in #218 rather than guarded.
 */
class OptionalPackagesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'artisanpack:optional-packages-command';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Install optional ArtisanPack UI packages';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->updateProjectName();

        $packages = multiselect(
            __('Which optional packages would you like to install?'),
            [
                'artisanpack-ui/cms-framework',
                'artisanpack-ui/code-style',
                'artisanpack-ui/code-style-pint',
                'artisanpack-ui/icons',
                'artisanpack-ui/hooks',
                'artisanpack-ui/media-library',
            ],
        );

        if (! empty($packages)) {
            $this->info('Installing selected optional packages...');
            $command = 'composer require '.implode(' ', $packages).' --with-all-dependencies';
            shell_exec($command);
            $this->info('Optional packages installed successfully.');
        }

        $this->info('Scaffolding ArtisanPack configuration...');
        $this->call('artisanpack:scaffold-config');

        $this->info('Installation complete.');

        return 0;
    }

    /**
     * Update the project name and description in composer.json.
     */
    protected function updateProjectName(): void
    {
        $composerJsonPath = base_path('composer.json');

        if (! File::exists($composerJsonPath)) {
            $this->error('composer.json file not found.');

            return;
        }

        try {
            $composerJson = json_decode(File::get($composerJsonPath), true);
        } catch (FileNotFoundException $e) {
            $this->error('Failed to read composer.json: '.$e->getMessage());

            return;
        }

        // Get the project directory name
        $projectName = basename(base_path());

        // Convert to kebab-case if needed (handle spaces, underscores, etc.)
        $projectName = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $projectName));
        $projectName = trim($projectName, '-');

        // Update the name field (format: vendor/project-name)
        $vendor               = 'laravel';
        $composerJson['name'] = "{$vendor}/{$projectName}";

        // Update the description to be generic
        $composerJson['description'] = 'A Laravel application.';

        File::put($composerJsonPath, json_encode($composerJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        $this->info('Updated composer.json with project name and description.');
    }
}
