<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\ThemeInstallException;
use ArtisanPackUI\CMSFramework\Modules\Themes\Managers\ThemeManager;
use ArtisanPackUI\CMSFramework\Modules\Themes\Validation\WpThemeJsonValidator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use JsonException;
use ZipArchive;

/**
 * Installs themes uploaded as zip archives.
 *
 * Owned by Keystone (not the cms-framework package) because install gating
 * is a consumer responsibility — see plans/08-themes-site-editor-arc.md.
 * The package's ThemeManager handles discovery + activation once the theme
 * is on disk; this service handles the upload → on-disk step:
 *
 *   1. Safety-checks the archive (size, entry count, zip-slip).
 *   2. Extracts to a temp dir.
 *   3. Locates and validates theme.json (incl. WP schema subset).
 *   4. Moves the theme into `base_path(cms.themes.directory)/{slug}`.
 *   5. Invalidates the ThemeManager discovery cache.
 */
class ThemeInstaller
{
    /** Max uncompressed bytes across all entries. Guards against zip bombs. */
    private const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;

    /** Max number of entries inside the archive. */
    private const MAX_ENTRIES = 2000;

    public function __construct(
        private ThemeManager $themeManager,
        private WpThemeJsonValidator $wpThemeJsonValidator,
    ) {}

    /**
     * @throws ThemeInstallException
     *
     * @return array{slug: string, manifest: array<string, mixed>}
     */
    public function install(UploadedFile $upload, bool $overwrite = false): array
    {
        $stagingPath = $this->extractToTemp($upload);

        try {
            $themeRoot = $this->locateThemeRoot($stagingPath);
            $manifest  = $this->loadAndValidateManifest($themeRoot.'/theme.json');
            $slug      = (string) ($manifest['slug'] ?? '');

            if ('' === $slug || ! $this->isSafeSlug($slug)) {
                throw ThemeInstallException::invalidManifest(__('manifest is missing a safe slug.'));
            }

            $destination = $this->themesBasePath().'/'.$slug;

            if (File::isDirectory($destination)) {
                if (! $overwrite) {
                    throw ThemeInstallException::alreadyInstalled($slug);
                }

                File::deleteDirectory($destination);
            }

            File::ensureDirectoryExists($this->themesBasePath());

            if (! File::moveDirectory($themeRoot, $destination)) {
                throw new ThemeInstallException(__('Failed to move the theme into the themes directory.'));
            }

            $this->forgetDiscoveryCache();

            return ['slug' => $slug, 'manifest' => $manifest];
        } finally {
            if (File::isDirectory($stagingPath)) {
                File::deleteDirectory($stagingPath);
            }
        }
    }

    /**
     * Removes an installed theme. Refuses to remove the currently active theme.
     *
     * @throws ThemeInstallException
     */
    public function uninstall(string $slug): void
    {
        if (! $this->isSafeSlug($slug)) {
            throw ThemeInstallException::invalidManifest(__('slug contains invalid characters.'));
        }

        $active = $this->themeManager->getActiveTheme();

        if (isset($active['slug']) && $active['slug'] === $slug) {
            throw new ThemeInstallException(__('You cannot remove the currently active theme.'));
        }

        $path = $this->themesBasePath().'/'.$slug;

        if (File::isDirectory($path)) {
            File::deleteDirectory($path);
        }

        $this->forgetDiscoveryCache();
    }

    private function extractToTemp(UploadedFile $upload): string
    {
        $zip = new ZipArchive;

        if (true !== $zip->open($upload->getRealPath())) {
            throw ThemeInstallException::unreadableZip();
        }

        $entryCount = $zip->numFiles;

        if ($entryCount > self::MAX_ENTRIES) {
            $zip->close();
            throw ThemeInstallException::tooLarge();
        }

        $totalUncompressed = 0;

        for ($i = 0; $i < $entryCount; $i++) {
            $stat = $zip->statIndex($i);

            if (false === $stat) {
                continue;
            }

            $name = (string) $stat['name'];

            if ($this->isUnsafeEntryName($name)) {
                $zip->close();
                throw ThemeInstallException::unsafeEntry($name);
            }

            $totalUncompressed += (int) ($stat['size'] ?? 0);

            if ($totalUncompressed > self::MAX_UNCOMPRESSED_BYTES) {
                $zip->close();
                throw ThemeInstallException::tooLarge();
            }
        }

        $staging = storage_path('app/theme-uploads/'.Str::random(16));
        File::ensureDirectoryExists($staging);

        if (true !== $zip->extractTo($staging)) {
            $zip->close();
            File::deleteDirectory($staging);
            throw ThemeInstallException::unreadableZip();
        }

        $zip->close();

        return $staging;
    }

    private function isUnsafeEntryName(string $name): bool
    {
        if ('' === $name) {
            return true;
        }

        // Normalize separators so a zip authored on Windows can't bypass
        // the parent-segment check with backslashes (e.g. `..\payload`).
        $normalized = str_replace('\\', '/', $name);

        if (str_starts_with($normalized, '/')) {
            return true;
        }

        if (1 === preg_match('#(?:^|/)\\.\\.(?:/|$)#', $normalized)) {
            return true;
        }

        if (1 === preg_match('#^[A-Za-z]:/#', $normalized)) {
            return true;
        }

        return false;
    }

    /**
     * Returns the directory that contains theme.json. Handles zips that
     * wrap the theme in a single top-level directory (e.g. GitHub-style
     * downloads).
     */
    private function locateThemeRoot(string $stagingPath): string
    {
        if (File::exists($stagingPath.'/theme.json')) {
            return $stagingPath;
        }

        $entries = File::directories($stagingPath);

        if (1 === count($entries) && File::exists($entries[0].'/theme.json')) {
            return $entries[0];
        }

        throw ThemeInstallException::missingManifest();
    }

    /**
     * @return array<string, mixed>
     */
    private function loadAndValidateManifest(string $path): array
    {
        $raw = File::get($path);

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw ThemeInstallException::invalidManifest($e->getMessage());
        }

        if (! is_array($decoded)) {
            throw ThemeInstallException::invalidManifest(__('theme.json must decode to an object.'));
        }

        $result = $this->wpThemeJsonValidator->validate($decoded);

        if (! $result->valid) {
            throw ThemeInstallException::manifestSchemaFailed(
                $result->offendingKey ?? 'unknown',
                $result->message ?? __('unknown error'),
            );
        }

        return $decoded;
    }

    private function isSafeSlug(string $slug): bool
    {
        return 1 === preg_match('/^[a-z0-9][a-z0-9_\-]*$/i', $slug);
    }

    private function themesBasePath(): string
    {
        return base_path((string) config('cms.themes.directory', 'themes'));
    }

    private function forgetDiscoveryCache(): void
    {
        $key = (string) config('cms.themes.cacheKey', 'cms.themes.discovered');
        Cache::forget($key);
    }
}
