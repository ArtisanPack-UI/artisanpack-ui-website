<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class WayfinderSanitizePaths extends Command
{
    protected $signature = 'wayfinder:sanitize-paths
                            {--check : Exit non-zero if any file would change, without rewriting}';

    protected $description = 'Rewrite symlink-resolved vendor paths in Wayfinder-generated TS back to repo-relative vendor/ paths.';

    /**
     * Wayfinder emits `@see` JSDoc lines using `ReflectionClass::getFileName()`,
     * which resolves symlinks. When a vendor package is symlinked into
     * `vendor/<vendor>/<package>` for local development, the emitted path leaks
     * the developer's workstation location. This command rewrites those paths
     * back to repo-relative `vendor/<vendor>/<package>/...` form using the
     * symlink targets it can detect on disk.
     */
    public function handle(): int
    {
        $check    = (bool) $this->option('check');
        $mappings = $this->buildSymlinkMappings();

        // In rewrite mode with no symlinks present, there's literally nothing to
        // do. In --check mode we still scan: CI installs from Packagist, has no
        // symlinks, and is exactly where we want to flag committed leaks.
        if (empty($mappings) && ! $check) {
            $this->info('No symlinked vendor packages detected; nothing to sanitize.');

            return self::SUCCESS;
        }

        $dirs = [
            base_path('resources/js/actions'),
            base_path('resources/js/routes'),
        ];

        $changed = [];

        foreach ($dirs as $dir) {
            if (! is_dir($dir)) {
                continue;
            }

            foreach (File::allFiles($dir) as $file) {
                $contents = $file->getContents();

                if (! empty($mappings)) {
                    $rewritten = strtr($contents, $mappings);

                    if ($rewritten !== $contents) {
                        $changed[] = $file->getPathname();

                        if (! $check) {
                            File::put($file->getPathname(), $rewritten);
                        }

                        continue;
                    }
                }

                if ($check && $this->containsLeakedSeePath($contents)) {
                    $changed[] = $file->getPathname();
                }
            }
        }

        $count = count($changed);

        if ($check) {
            if (0 === $count) {
                $this->info('Wayfinder output is clean.');

                return self::SUCCESS;
            }

            $this->warn("Wayfinder output has {$count} file(s) with workstation-absolute paths:");
            foreach ($changed as $path) {
                $this->line('  '.$path);
            }

            return self::FAILURE;
        }

        $this->info("Sanitized {$count} file(s).");

        return self::SUCCESS;
    }

    /**
     * Detect whether a generated file carries an `@see` path that is neither an
     * FQCN reference nor a repo-relative path. Used by --check on machines that
     * don't have the symlinks locally (e.g. CI), so previously-committed leaks
     * still get flagged.
     */
    private function containsLeakedSeePath(string $contents): bool
    {
        if (! preg_match_all('/^\s*\*\s*@see\s+(.+)$/m', $contents, $matches)) {
            return false;
        }

        $repoRoots = ['vendor/', 'app/', 'routes/', 'bootstrap/', 'database/', 'config/', 'tests/', 'resources/'];

        foreach ($matches[1] as $reference) {
            $ref = trim($reference);

            if (str_starts_with($ref, '\\')) {
                continue;
            }

            $isRepoRelative = false;
            foreach ($repoRoots as $root) {
                if (str_starts_with($ref, $root)) {
                    $isRepoRelative = true;

                    break;
                }
            }

            if (! $isRepoRelative) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build a map of leaked-path-prefix → vendor-relative-prefix for every
     * vendor package directory that is actually a symlink.
     *
     * @return array<string, string>
     */
    private function buildSymlinkMappings(): array
    {
        $vendorDir = base_path('vendor');
        $mappings  = [];

        foreach (glob($vendorDir.'/*', GLOB_ONLYDIR) ?: [] as $vendorNamespace) {
            foreach (glob($vendorNamespace.'/*', GLOB_ONLYDIR) ?: [] as $packageDir) {
                if (! is_link($packageDir)) {
                    continue;
                }

                $real = realpath($packageDir);

                if (! $real || $real === $packageDir) {
                    continue;
                }

                // Wayfinder strips the leading directory separator after a no-op
                // base_path() replace, so the leaked form has no leading slash.
                $leaked         = ltrim($real, DIRECTORY_SEPARATOR);
                $vendorRelative = 'vendor/'.basename($vendorNamespace).'/'.basename($packageDir);

                $mappings[$leaked] = $vendorRelative;
            }
        }

        return $mappings;
    }
}
