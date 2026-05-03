<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\FileNotFoundException;
use Illuminate\Support\Facades\File;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\multiselect;

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
            ]
        );

        if (! empty($packages)) {
            $this->info('Installing selected optional packages...');
            $command = 'composer require '.implode(' ', $packages).' --with-all-dependencies';
            shell_exec($command);
            $this->info('Optional packages installed successfully.');
        }

        $useModularStructure = confirm(
            __('Would you like to use a modular Laravel structure?'),
            default: false
        );

        if ($useModularStructure) {
            $this->info('Setting up modular Laravel structure...');
            $this->setupModularStructure();
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
        $vendor = 'laravel';
        $composerJson['name'] = "{$vendor}/{$projectName}";

        // Update the description to be generic
        $composerJson['description'] = 'A Laravel application.';

        File::put($composerJsonPath, json_encode($composerJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        $this->info('Updated composer.json with project name and description.');
    }

    /**
     * Set up the modular Laravel structure.
     */
    protected function setupModularStructure(): void
    {
        // Install Laravel Modules package. The mhmiton/laravel-modules-livewire
        // adapter is intentionally not installed here — it's Livewire-specific
        // and there's no Inertia equivalent.
        $this->info('Installing nwidart/laravel-modules package...');
        shell_exec('composer require nwidart/laravel-modules --with-all-dependencies');

        // Publish configuration files
        $this->info('Publishing module configuration files...');
        shell_exec('php artisan vendor:publish --provider="Nwidart\Modules\LaravelModulesServiceProvider"');

        // Update composer.json for module autoloading
        $this->info('Updating composer.json for module autoloading...');
        $this->updateComposerJson();

        // Create default modules
        $this->info('Creating default modules (Admin, Auth, Users)...');
        $this->createDefaultModules();

        // Run composer dump-autoload
        $this->info('Running composer dump-autoload...');
        shell_exec('composer dump-autoload');

        $this->info('Modular structure setup complete!');
    }

    /**
     * Update composer.json to include module autoloading.
     */
    protected function updateComposerJson(): void
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

        // Add merge-plugin configuration if it doesn't exist
        if (! isset($composerJson['extra']['merge-plugin'])) {
            $composerJson['extra']['merge-plugin'] = [
                'include' => [
                    'Modules/*/composer.json',
                ],
            ];

            File::put($composerJsonPath, json_encode($composerJson, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
            $this->info('Updated composer.json with module autoloading configuration.');
        }
    }

    /**
     * Create the default modules (Admin, Auth, Users).
     */
    protected function createDefaultModules(): void
    {
        $modules = ['Admin', 'Auth', 'Users'];

        foreach ($modules as $module) {
            $this->info("Creating $module module...");
            shell_exec("php artisan module:make $module --no-interaction");
        }

        $this->info('Default modules created successfully.');
    }
}
