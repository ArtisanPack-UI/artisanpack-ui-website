<?php

declare(strict_types=1);

namespace Modules\Themes\Services;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Models\Menu;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Models\MenuItem;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Models\MenuLocationAssignment;
use ArtisanPackUI\CMSFramework\Modules\SiteEditor\Models\TemplatePart;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use JsonException;
use RuntimeException;

/**
 * Reads a theme's optional `seed.json` and hydrates settings, template
 * parts, menus, and pages on first activation. Idempotent: per-theme
 * `themes.{slug}.seedApplied` setting prevents re-running on subsequent
 * activations. Re-seed is an explicit admin action (not yet wired).
 *
 * The seed convention is a Keystone extension — `theme.json` stays
 * WP-spec-conformant; this file lives next to it and is consumed only
 * by this service.
 *
 * Schema (seed.json):
 *
 *     {
 *       "version": 1,
 *       "settings":      { "site.title": "…" },
 *       "templateParts": [ { "slug", "area", "title", "blocks": [...] } ],
 *       "menus":         [ { "slug", "name", "location?", "items": [...] } ],
 *       "pages":         [ { "slug", "title", "status?", "isHomepage?", "blocks": [...] } ]
 *     }
 */
class ThemeSeedApplier
{
    public const SETTING_KEY_TEMPLATE = 'themes.%s.seedApplied';

    public function __construct(
        private SettingsManager $settings,
    ) {}

    /**
     * Apply the seed for the given theme slug if it hasn't been applied yet.
     * Returns true when seeds were applied; false when skipped (no file or
     * already applied).
     */
    public function apply(string $slug): bool
    {
        $key = sprintf(self::SETTING_KEY_TEMPLATE, $slug);

        // Cache lock serializes concurrent activate requests so the
        // read-flag / apply / write-flag sequence stays a one-time guarantee.
        // 60s TTL guards against a crashed holder; 10s wait covers the window
        // where another request is mid-apply.
        return Cache::lock("theme-seed-applier:{$slug}", 60)->block(10, function () use ($slug, $key): bool {
            if (true === $this->settings->getSetting($key, false)) {
                return false;
            }

            $seedPath = $this->themesBasePath().'/'.$slug.'/seed.json';

            if (! File::exists($seedPath)) {
                $this->settings->updateSetting($key, true);

                return false;
            }

            $seed = $this->decode($seedPath);

            DB::transaction(function () use ($slug, $seed): void {
                $this->applySettings($seed['settings'] ?? []);
                $this->applyTemplateParts($slug, $seed['templateParts'] ?? []);
                $this->applyMenus($slug, $seed['menus'] ?? []);
                $this->applyPages($seed['pages'] ?? []);
            });

            $this->settings->updateSetting($key, true);

            // Emit a summary of what was seeded so subscribers can react
            // without re-reading the manifest. Counts rather than full
            // payloads keep the fire cheap.
            doAction('keystone.admin.themes.seeded', $slug, [
                'settings'      => count((array) ($seed['settings'] ?? [])),
                'templateParts' => count((array) ($seed['templateParts'] ?? [])),
                'menus'         => count((array) ($seed['menus'] ?? [])),
                'pages'         => count((array) ($seed['pages'] ?? [])),
            ]);

            return true;
        });
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function applySettings(array $settings): void
    {
        foreach ($settings as $key => $value) {
            if (! is_string($key) || '' === $key) {
                continue;
            }

            $this->settings->updateSetting($key, $value);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $parts
     */
    private function applyTemplateParts(string $themeSlug, array $parts): void
    {
        foreach ($parts as $part) {
            $partSlug = (string) ($part['slug'] ?? '');
            $area     = (string) ($part['area'] ?? 'general');

            if ('' === $partSlug) {
                continue;
            }

            if (! in_array($area, TemplatePart::AREAS, true)) {
                $area = 'general';
            }

            // Seed only fills in missing parts; respect any prior author edits.
            if (TemplatePart::where('theme', $themeSlug)->where('slug', $partSlug)->exists()) {
                continue;
            }

            TemplatePart::create([
                'theme'         => $themeSlug,
                'slug'          => $partSlug,
                'title'         => (string) ($part['title'] ?? $partSlug),
                'description'   => $part['description'] ?? null,
                'area'          => $area,
                'status'        => 'published',
                'is_custom'     => false,
                'block_content' => $this->normalizeBlocks($part['blocks'] ?? []),
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $menus
     */
    private function applyMenus(string $themeSlug, array $menus): void
    {
        foreach ($menus as $menuSeed) {
            $menuSlug = (string) ($menuSeed['slug'] ?? '');

            if ('' === $menuSlug) {
                continue;
            }

            $menu = Menu::where('theme', $themeSlug)
                ->where('slug', $menuSlug)
                ->first();

            if (null === $menu) {
                $menu = Menu::create([
                    'theme'          => $themeSlug,
                    'slug'           => $menuSlug,
                    'name'           => (string) ($menuSeed['name'] ?? $menuSlug),
                    'description'    => $menuSeed['description'] ?? null,
                    'auto_add_pages' => (bool) ($menuSeed['autoAddPages'] ?? false),
                ]);

                $this->createMenuItems($menu, (array) ($menuSeed['items'] ?? []), null);
            }

            $location = (string) ($menuSeed['location'] ?? '');

            if ('' !== $location) {
                MenuLocationAssignment::firstOrCreate(
                    ['theme' => $themeSlug, 'location' => $location],
                    ['menu_id' => $menu->id],
                );
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     */
    private function createMenuItems(Menu $menu, array $items, ?int $parentId): void
    {
        $position = 0;

        foreach ($items as $itemSeed) {
            $type = (string) ($itemSeed['type'] ?? MenuItem::TYPE_LINK);

            if (! in_array($type, MenuItem::TYPES, true)) {
                $type = MenuItem::TYPE_LINK;
            }

            $created = MenuItem::create([
                'menu_id'     => $menu->id,
                'parent_id'   => $parentId,
                'position'    => $position++,
                'type'        => $type,
                'label'       => (string) ($itemSeed['label'] ?? ''),
                'url'         => $itemSeed['url'] ?? null,
                'target'      => (string) ($itemSeed['target'] ?? '_self'),
                'rel'         => $itemSeed['rel'] ?? null,
                'classes'     => $itemSeed['classes'] ?? null,
                'description' => $itemSeed['description'] ?? null,
                'object_type' => $itemSeed['objectType'] ?? null,
                'object_id'   => $itemSeed['objectId'] ?? null,
            ]);

            $children = (array) ($itemSeed['items'] ?? []);

            if ([] !== $children) {
                $this->createMenuItems($menu, $children, $created->id);
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $pages
     */
    private function applyPages(array $pages): void
    {
        $authorId = $this->resolveSeedAuthorId();

        foreach ($pages as $pageSeed) {
            $slug = (string) ($pageSeed['slug'] ?? '');

            if ('' === $slug) {
                continue;
            }

            if (Page::where('slug', $slug)->withTrashed()->exists()) {
                continue;
            }

            $page = Page::create([
                'title'        => (string) ($pageSeed['title'] ?? $slug),
                'slug'         => $slug,
                'content'      => $pageSeed['content'] ?? null,
                'excerpt'      => $pageSeed['excerpt'] ?? null,
                'author_id'    => $authorId,
                'order'        => (int) ($pageSeed['order'] ?? 0),
                'template'     => $pageSeed['template'] ?? null,
                'status'       => $this->resolveStatus($pageSeed['status'] ?? 'published'),
                'published_at' => now(),
                'metadata'     => $pageSeed['metadata'] ?? null,
            ]);

            // `block_content` isn't in Page's `$fillable`; set via the trait helper.
            $page->setBlockContent($this->normalizeBlocks($pageSeed['blocks'] ?? []));
            $page->save();

            if (true === ($pageSeed['isHomepage'] ?? false)) {
                $this->settings->updateSetting('site.homepageId', $page->id);
            }
        }
    }

    private function resolveStatus(mixed $raw): ContentStatus
    {
        if ($raw instanceof ContentStatus) {
            return $raw;
        }

        $value = is_string($raw) ? strtolower($raw) : 'published';

        foreach (ContentStatus::cases() as $case) {
            if ($case->value === $value) {
                return $case;
            }
        }

        return ContentStatus::Published;
    }

    /**
     * Seeded pages need an `author_id`. We prefer the first admin user; fall
     * back to user #1 if no role is wired; ultimately fall back to null only
     * if the column accepts it (it doesn't, so we'd surface the error rather
     * than silently mislabel authorship).
     */
    private function resolveSeedAuthorId(): int
    {
        $userModel = (string) config('auth.providers.users.model');
        /** @var class-string<Model> $userModel */
        $user = $userModel::query()->orderBy('id')->first();

        if (null === $user) {
            throw new RuntimeException('Cannot seed pages: no users exist to attribute authorship to.');
        }

        return (int) $user->getKey();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function normalizeBlocks(mixed $blocks): array
    {
        if (! is_array($blocks)) {
            return [];
        }

        $stamped = [];

        foreach ($blocks as $block) {
            if (! is_array($block)) {
                continue;
            }

            $stamped[] = $this->stampBlock($block);
        }

        return $stamped;
    }

    /**
     * Stamps a block with the runtime fields the visual editor's data store
     * needs. Gutenberg keys its `core/block-editor` store by `clientId` and
     * silently ignores blocks that don't carry one — the canvas renders
     * blank for those entries even though they're in the API response.
     * `isValid: true` mirrors what `parse()` would stamp for hand-authored
     * block markup and keeps the editor from second-guessing the tree.
     *
     * Empty `attributes` is widened to a placeholder so PHP's JSON cast
     * doesn't lose the object-vs-array distinction on a roundtrip — a
     * block with `attributes: []` in the API response would be treated as
     * invalid by the editor.
     *
     * @param  array<string, mixed>  $block
     *
     * @return array<string, mixed>
     */
    private function stampBlock(array $block): array
    {
        $attributes = $block['attributes'] ?? [];

        if (! is_array($attributes) || [] === $attributes) {
            // `metadata` is a real WP-supported attribute; an empty object
            // is harmless to the editor and keeps the JSON shape correct.
            $attributes = ['metadata' => (object) []];
        }

        $children = [];

        if (isset($block['innerBlocks']) && is_array($block['innerBlocks'])) {
            foreach ($block['innerBlocks'] as $child) {
                if (is_array($child)) {
                    $children[] = $this->stampBlock($child);
                }
            }
        }

        // `clientId` must be a non-empty string — Gutenberg's data store
        // keys blocks by it and treats blank / non-string values as
        // missing, which drops the block from the canvas the same way a
        // null `clientId` would. Re-stamp anything that doesn't look
        // usable.
        $clientId = $block['clientId'] ?? null;

        if (! is_string($clientId) || '' === trim($clientId)) {
            $clientId = (string) Str::uuid();
        }

        return [
            'clientId'    => $clientId,
            'name'        => $block['name'] ?? '',
            'isValid'     => true,
            'attributes'  => $attributes,
            'innerBlocks' => $children,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(string $path): array
    {
        $raw = File::get($path);

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException("Invalid seed.json at {$path}: ".$e->getMessage(), previous: $e);
        }

        if (! is_array($decoded)) {
            throw new RuntimeException("seed.json at {$path} must decode to an object.");
        }

        return $decoded;
    }

    private function themesBasePath(): string
    {
        return base_path((string) config('cms.themes.directory', 'themes'));
    }
}
