<?php

declare(strict_types=1);

namespace App\Support\AdminMenu;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use Illuminate\Contracts\Auth\Access\Gate;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Routing\UrlGenerator;
use Illuminate\Support\Str;
use Modules\ContentModel\Support\SpecializedContentTypes;
use Modules\Users\Models\User;
use Modules\Users\Support\Permissions\PermissionSlugResolver;
use Throwable;

/**
 * Builds the Keystone admin sidebar menu as a plain data structure suitable
 * for the Inertia shared prop. The React admin layout renders it verbatim,
 * so a plugin subscribing to `ap.cmsFramework.admin.menu` can inject sidebar entries
 * without touching {@see \App\Http\Middleware\HandleInertiaRequests} or the
 * React nav component.
 *
 * The filter accepts two shapes of injected entries:
 *   - Group-shaped: `['key' => …, 'label' => …, 'items' => [...]]`
 *   - Flat item-shaped (what the framework's `PluginServiceProvider::registerNavEntry()`
 *     writes via `PluginsServiceProvider`): a slug-keyed item with
 *     `label`/`url`/`iconId`/`permission`/`external`. Flat items get collected
 *     into a single synthesized "Plugins" group so the framework's documented
 *     plugin path works without every plugin author having to know Keystone's
 *     group shape.
 *
 * Output shape (per group):
 *
 * @phpstan-type AdminMenuChild array{
 *     key: string,
 *     label: string,
 *     url: string,
 *     matchPrefix?: string|list<string>,
 *     permission?: string,
 * }
 * @phpstan-type AdminMenuItem array{
 *     key: string,
 *     label: string,
 *     iconId: string,
 *     url: string,
 *     external: bool,
 *     badge?: int,
 *     children?: list<AdminMenuChild>,
 *     permission?: string,
 * }
 * @phpstan-type AdminMenuGroup array{
 *     key: string,
 *     label: string,
 *     items: list<AdminMenuItem>,
 * }
 */
class AdminMenuBuilder
{
    public function __construct(
        private readonly UrlGenerator $urlGenerator,
        private readonly Gate $gate,
        private readonly PermissionSlugResolver $permissionResolver,
        private readonly Container $container,
    ) {}

    /**
     * Build the resolved admin menu for the given user.
     *
     * @param  array<string, bool>|null  $features  Feature flags to gate base
     *                                              groups on. When null, they
     *                                              are resolved from settings —
     *                                              pass them in from the caller
     *                                              (Inertia middleware) to
     *                                              avoid a duplicate lookup.
     *
     * @return list<AdminMenuGroup>
     */
    public function build(?User $user, ?array $features = null): array
    {
        $context = $this->contextFor($user, $features);
        $groups  = $this->baseGroups($context);

        if (function_exists('applyFilters')) {
            /** @var mixed $filtered */
            $filtered = applyFilters('ap.cmsFramework.admin.menu', $groups, $context);
            if (is_array($filtered)) {
                $groups = $filtered;
            }
        }

        return $this->normalize($groups, $user);
    }

    /**
     * @param  array<string, bool>|null  $features
     *
     * @return array{roles: list<string>, permissions: list<string>, features: array<string, bool>}
     */
    private function contextFor(?User $user, ?array $features): array
    {
        $roles       = null === $user ? [] : $user->roles->pluck('slug')->all();
        $permissions = null === $user ? [] : $this->permissionResolver->slugsFor($user);

        return [
            'roles'       => $roles,
            'permissions' => $permissions,
            'features'    => $features ?? [
                'blog'      => (bool) keystone('features.blog', false),
                'analytics' => (bool) keystone('features.analytics', false),
                'ecommerce' => (bool) keystone('features.ecommerce', false),
                'forms'     => (bool) keystone('features.forms', false),
                'booking'   => (bool) keystone('features.booking', false),
            ],
        ];
    }

    /**
     * @param  array{roles: list<string>, permissions: list<string>, features: array<string, bool>}  $context
     *
     * @return list<array<string, mixed>>
     */
    private function baseGroups(array $context): array
    {
        $features       = $context['features'];
        $roles          = $context['roles'];
        $permissions    = $context['permissions'];
        $isAdmin        = in_array('admin', $roles, true);
        $canManageUsers = $isAdmin || in_array('site_owner', $roles, true);
        $canRunUpdater  = $isAdmin && in_array('updater.run', $permissions, true);
        $canViewPerf    = in_array('performance.view', $permissions, true);

        $pagesIndex = $this->route('admin.pages.index');
        $postsIndex = $this->route('admin.posts.index');
        $consents   = $this->route('admin.privacy.consents');
        $perfOview  = $this->route('admin.performance.overview');
        $usersIndex = $this->route('admin.users.index');
        $profile    = $this->route('admin.profile');

        $contentItems = [
            [
                'key'      => 'pages',
                'label'    => 'Pages',
                'iconId'   => 'pages',
                'url'      => $pagesIndex,
                'children' => [
                    ['key' => 'pages-all', 'label' => 'All Pages', 'url' => $pagesIndex],
                    // #184 — "Add Page" opens the Add-New modal via the
                    // Index page's `?new=1` query flag; the killed
                    // `admin.pages.create` auto-draft route is gone.
                    ['key' => 'pages-new', 'label' => 'Add Page', 'url' => $this->route('admin.pages.index', ['new' => 1])],
                ],
            ],
        ];

        if ($features['blog'] ?? false) {
            $contentItems[] = [
                'key'      => 'posts',
                'label'    => 'Blog Posts',
                'iconId'   => 'posts',
                'url'      => $postsIndex,
                'children' => [
                    ['key' => 'posts-all', 'label' => 'All Posts', 'url' => $postsIndex],
                    ['key' => 'posts-new', 'label' => 'Add Post', 'url' => $this->route('admin.posts.index', ['new' => 1])],
                    ['key' => 'posts-categories', 'label' => 'Categories', 'url' => $this->route('admin.posts.categories.index')],
                    ['key' => 'posts-tags', 'label' => 'Tags', 'url' => $this->route('admin.posts.tags.index')],
                ],
            ];
        }

        $contentItems[] = [
            'key'    => 'media',
            'label'  => 'Media',
            'iconId' => 'media',
            'url'    => $this->route('admin.media.index'),
        ];

        // #106 — dynamic nav entries per registered content type. Iterates
        // `ContentTypeManager::getRegisteredContentTypes()` so that both
        // DB-persisted types (created via /admin/content-model/content-types)
        // and code/plugin-registered types get a nav row without either side
        // needing to write Keystone-specific integration code. `post` and
        // `page` keep their hardcoded entries above — they have bespoke
        // edit UIs (visual editor + featured image) that the generic
        // dynamic-content routes don't render.
        foreach ($this->dynamicContentTypeItems() as $item) {
            $contentItems[] = $item;
        }

        $groups = [
            [
                'key'   => 'overview',
                'label' => 'Overview',
                'items' => [
                    [
                        'key'    => 'dashboard',
                        'label'  => 'Dashboard',
                        'iconId' => 'dashboard',
                        'url'    => $this->route('admin.dashboard'),
                    ],
                ],
            ],
            ['key' => 'content', 'label' => 'Content', 'items' => $contentItems],
        ];

        if ($features['ecommerce'] ?? false) {
            $groups[] = [
                'key'   => 'store',
                'label' => 'Online Store',
                'items' => [
                    ['key' => 'products', 'label' => 'Products', 'iconId' => 'cart', 'url' => $this->route('admin.products')],
                    ['key' => 'orders', 'label' => 'Orders', 'iconId' => 'orders', 'url' => $this->route('admin.orders')],
                    ['key' => 'customers', 'label' => 'Customers', 'iconId' => 'customers', 'url' => $this->route('admin.customers')],
                ],
            ];
        }

        if ($features['forms'] ?? false) {
            $groups[] = [
                'key'   => 'leads',
                'label' => 'Lead Generation',
                'items' => [
                    [
                        'key'    => 'forms',
                        'label'  => 'Forms',
                        'iconId' => 'forms',
                        'url'    => $this->route('admin.forms.index'),
                    ],
                ],
            ];
        }

        if ($canManageUsers) {
            $groups[] = [
                'key'   => 'privacy',
                'label' => 'Privacy',
                'items' => [
                    [
                        'key'      => 'privacy',
                        'label'    => 'Privacy',
                        'iconId'   => 'settings',
                        'url'      => $consents,
                        'children' => [
                            ['key' => 'privacy-consents', 'label' => 'Consent Manager', 'url' => $consents],
                            ['key' => 'privacy-dsr', 'label' => 'Data Subject Requests', 'url' => $this->route('admin.privacy.data-requests')],
                            ['key' => 'privacy-breaches', 'label' => 'Breach Manager', 'url' => $this->route('admin.privacy.breaches')],
                            ['key' => 'privacy-reports', 'label' => 'Compliance Reports', 'url' => $this->route('admin.privacy.reports')],
                        ],
                    ],
                ],
            ];
        }

        if ($canViewPerf) {
            $groups[] = [
                'key'   => 'performance',
                'label' => 'Performance',
                'items' => [
                    [
                        'key'      => 'performance',
                        'label'    => 'Performance',
                        'iconId'   => 'reports',
                        'url'      => $perfOview,
                        'children' => [
                            ['key' => 'performance-overview', 'label' => 'Overview', 'url' => $perfOview],
                            ['key' => 'performance-slow-queries', 'label' => 'Slow Queries', 'url' => $this->route('admin.performance.slow-queries')],
                            ['key' => 'performance-index-suggestions', 'label' => 'Index Suggestions', 'url' => $this->route('admin.performance.index-suggestions')],
                            ['key' => 'performance-cache', 'label' => 'Cache Management', 'url' => $this->route('admin.performance.cache')],
                        ],
                    ],
                ],
            ];
        }

        $siteItems = [
            ['key' => 'site-design', 'label' => 'Site Design', 'iconId' => 'site', 'url' => $this->route('admin.site-design')],
        ];
        if ($isAdmin) {
            $siteItems[] = [
                'key'      => 'site-editor',
                'label'    => 'Site Editor',
                'iconId'   => 'edit',
                'url'      => $this->route('admin.site-editor'),
                'external' => true,
            ];
        }
        $siteItems[] = ['key' => 'settings', 'label' => 'Settings', 'iconId' => 'settings', 'url' => $this->route('admin.settings')];

        $groups[] = ['key' => 'site', 'label' => 'Site', 'items' => $siteItems];

        $userChildren = [];
        if ($canManageUsers) {
            $userChildren[] = ['key' => 'users-all', 'label' => 'All Users', 'url' => $usersIndex];
            $userChildren[] = ['key' => 'users-new', 'label' => 'Add User', 'url' => $this->route('admin.users.create')];
        }
        if ($isAdmin) {
            $userChildren[] = ['key' => 'users-roles', 'label' => 'Roles', 'url' => $this->route('admin.roles.index')];
            $userChildren[] = ['key' => 'users-permissions', 'label' => 'Permissions', 'url' => $this->route('admin.permissions.index')];
        }
        $userChildren[] = [
            'key'         => 'users-profile',
            'label'       => 'Profile',
            'url'         => $profile,
            'matchPrefix' => [
                $profile,
                $this->route('admin.password'),
                $this->route('admin.appearance'),
                $this->route('admin.two-factor'),
            ],
        ];

        $systemItems = [
            [
                'key'      => 'users',
                'label'    => 'Users',
                'iconId'   => 'users',
                'url'      => $canManageUsers ? $usersIndex : $profile,
                'children' => $userChildren,
            ],
            ['key' => 'integrations', 'label' => 'Integrations', 'iconId' => 'integrations', 'url' => $this->route('admin.integrations')],
            ['key' => 'redirects', 'label' => 'Redirects', 'iconId' => 'integrations', 'url' => $this->route('admin.seo.redirects.index')],
        ];

        if ($features['analytics'] ?? false) {
            $systemItems[] = ['key' => 'reports', 'label' => 'Reports', 'iconId' => 'reports', 'url' => $this->route('admin.reports')];
        }
        if ($isAdmin) {
            // #105 — Content Model group. Grouped as a single expandable
            // System item so the three tightly-related pages (types,
            // taxonomies, custom fields) don't crowd the System list.
            $systemItems[] = [
                'key'      => 'content-model',
                'label'    => 'Content Model',
                'iconId'   => 'edit',
                'url'      => $this->route('admin.content-model.content-types.index'),
                'children' => [
                    ['key' => 'content-model-types', 'label' => 'Content Types', 'url' => $this->route('admin.content-model.content-types.index')],
                    ['key' => 'content-model-taxonomies', 'label' => 'Taxonomies', 'url' => $this->route('admin.content-model.taxonomies.index')],
                    ['key' => 'content-model-fields', 'label' => 'Custom Fields', 'url' => $this->route('admin.content-model.custom-fields.index')],
                ],
            ];
            $systemItems[] = ['key' => 'plugins', 'label' => 'Plugins', 'iconId' => 'integrations', 'url' => $this->route('admin.system.plugins.index')];
        }
        if ($canRunUpdater) {
            $systemItems[] = ['key' => 'updates', 'label' => 'Updates', 'iconId' => 'upload', 'url' => $this->route('admin.settings.updates')];
        }
        $systemItems[] = ['key' => 'activity-log', 'label' => 'Activity Log', 'iconId' => 'activity', 'url' => $this->route('admin.activity-log')];
        $systemItems[] = ['key' => 'notifications', 'label' => 'Notifications', 'iconId' => 'bell', 'url' => $this->route('admin.notifications')];

        $groups[] = ['key' => 'system', 'label' => 'System', 'items' => $systemItems];

        return $groups;
    }

    /**
     * Normalize the (possibly filter-mutated) menu structure. Handles both
     * group-shaped entries (containing an `items` list) and flat item-shaped
     * entries — the framework's `registerNavEntry()` API writes the latter,
     * so treating everything as a group would silently drop plugin nav
     * entries registered through the documented path.
     *
     * Also enforces per-row `permission` gating so filter-injected rows
     * can't bypass the Gate — mirrors the framework's
     * `AdminMenuManager::enforceCapabilities()` behavior.
     *
     * @param  array<mixed>|list<array<string, mixed>>  $entries
     *
     * @return list<AdminMenuGroup>
     */
    private function normalize(array $entries, ?User $user): array
    {
        $normalized  = [];
        $pluginItems = [];

        foreach ($entries as $entryKey => $entry) {
            if (! is_array($entry)) {
                continue;
            }
            if (! $this->userMay($user, $entry)) {
                continue;
            }

            if (isset($entry['items']) && is_array($entry['items'])) {
                $items = [];
                foreach ($entry['items'] as $itemKey => $item) {
                    if (! is_array($item) || ! $this->userMay($user, $item)) {
                        continue;
                    }
                    $items[] = $this->normalizeItem($item, (string) $itemKey, $user);
                }

                if ([] === $items) {
                    continue;
                }

                $normalized[] = [
                    'key'   => (string) ($entry['key'] ?? $entryKey),
                    'label' => (string) ($entry['label'] ?? ''),
                    'items' => $items,
                ];

                continue;
            }

            // Flat item shape — collect into a synthesized "Plugins" group.
            $pluginItems[] = $this->normalizeItem($entry, (string) $entryKey, $user);
        }

        if ([] !== $pluginItems) {
            $normalized[] = [
                'key'   => 'plugins',
                'label' => 'Plugins',
                'items' => $pluginItems,
            ];
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $item
     *
     * @return AdminMenuItem
     */
    private function normalizeItem(array $item, string $fallbackKey, ?User $user): array
    {
        $normalized = [
            'key'      => (string) ($item['key'] ?? $item['slug'] ?? $fallbackKey),
            'label'    => (string) ($item['label'] ?? $item['menuTitle'] ?? $item['title'] ?? ''),
            'iconId'   => (string) ($item['iconId'] ?? $item['icon'] ?? ''),
            'url'      => $this->resolveUrl($item),
            'external' => (bool) ($item['external'] ?? false),
        ];

        if (isset($item['badge']) && is_numeric($item['badge'])) {
            $badge = (int) $item['badge'];
            if ($badge > 0) {
                $normalized['badge'] = $badge;
            }
        }

        $rawChildren = $item['children'] ?? $item['subItems'] ?? null;
        if (is_array($rawChildren) && [] !== $rawChildren) {
            $children = [];
            foreach ($rawChildren as $childKey => $child) {
                if (! is_array($child) || ! $this->userMay($user, $child)) {
                    continue;
                }
                $childNormalized = [
                    'key'   => (string) ($child['key'] ?? $childKey),
                    'label' => (string) ($child['label'] ?? $child['menuTitle'] ?? $child['title'] ?? ''),
                    'url'   => $this->resolveUrl($child),
                ];
                $matchPrefix = $this->normalizeMatchPrefix($child['matchPrefix'] ?? null);
                if (null !== $matchPrefix) {
                    $childNormalized['matchPrefix'] = $matchPrefix;
                }
                $children[] = $childNormalized;
            }

            if ([] !== $children) {
                $normalized['children'] = $children;
            }
        }

        return $normalized;
    }

    /**
     * Coerce a plugin-supplied `matchPrefix` to `string|list<string>` and
     * reject anything else — an unchecked non-string leaks to the React
     * consumer where `startsWith(non-string)` coerces silently.
     *
     * @return list<string>|string|null
     */
    private function normalizeMatchPrefix(mixed $matchPrefix): string|array|null
    {
        if (is_string($matchPrefix) && '' !== $matchPrefix) {
            return $matchPrefix;
        }

        if (is_array($matchPrefix)) {
            $strings = array_values(array_filter(
                $matchPrefix,
                fn ($value) => is_string($value) && '' !== $value,
            ));

            return [] === $strings ? null : $strings;
        }

        return null;
    }

    /**
     * Resolve a `url` value from either an explicit `url`/`href` or a route
     * name. Filter subscribers using the framework's shape supply a `route`
     * (e.g. `admin.blog`); Keystone's base rows supply `url` directly.
     *
     * @param  array<string, mixed>  $item
     */
    private function resolveUrl(array $item): string
    {
        $raw = $item['url'] ?? $item['href'] ?? null;
        if (is_string($raw) && '' !== trim($raw)) {
            return $this->sanitizeUrl($raw);
        }

        $route = $item['route'] ?? null;
        if (is_string($route) && '' !== $route) {
            try {
                return $this->urlGenerator->route($route, [], false);
            } catch (Throwable) {
                return '#';
            }
        }

        return '#';
    }

    /**
     * Allow only navigation-safe URL forms. Blocks:
     *   - `javascript:` / `data:` / `vbscript:` / other unsafe schemes
     *   - Protocol-relative URLs (`//host/path`) that would redirect off-origin
     *     under whatever scheme the admin is served with
     *   - Backslash-prefixed URLs (`\\host`) that some legacy user-agents also
     *     resolve as protocol-relative
     *   - Embedded ASCII control characters (tabs/newlines/etc.) that browsers
     *     strip before parsing schemes — `java\nscript:alert(1)` normalizes to
     *     `javascript:` in an `<a href>`, so it must be rejected before we
     *     match on the leading scheme
     *
     * Mirrors the intent of
     * {@see \ArtisanPackUI\CMSFramework\Modules\Admin\Managers\AdminMenuManager::sanitizeExternalUrl()}
     * with additional protocol-relative and control-character guards.
     */
    private function sanitizeUrl(string $url): string
    {
        $trimmed = trim($url);
        if ('' === $trimmed) {
            return '#';
        }

        // Control chars (0x00–0x1F, 0x7F) — including tab, LF, CR, VT —
        // are stripped by browsers when normalizing an href, so a value
        // like "java\nscript:alert(1)" would resolve to "javascript:..."
        // after our scheme check ran on the unstripped string.
        if (1 === preg_match('/[\x00-\x1F\x7F]/', $trimmed)) {
            return '#';
        }

        if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '\\')) {
            return '#';
        }

        if (str_starts_with($trimmed, '/') || str_starts_with($trimmed, '#')) {
            return $trimmed;
        }

        if (1 === preg_match('#^([a-zA-Z][a-zA-Z0-9+.\-]*):#', $trimmed, $matches)) {
            $scheme = strtolower($matches[1]);
            if (in_array($scheme, ['http', 'https', 'mailto', 'tel'], true)) {
                return $trimmed;
            }

            return '#';
        }

        return $trimmed;
    }

    /**
     * Guard a menu row by its declared `permission`/`capability` (Gate ability).
     * Fails closed on any non-string permission value — a plugin author who
     * ships `['permission' => ['a','b']]` gets a hidden row rather than a
     * silently-ungated one.
     *
     * @param  array<string, mixed>  $node
     */
    private function userMay(?User $user, array $node): bool
    {
        $ability = $node['permission'] ?? $node['capability'] ?? null;
        if (null === $ability) {
            return true;
        }
        if (! is_string($ability)) {
            return false;
        }
        if ('' === $ability) {
            return true;
        }

        if (null === $user) {
            return false;
        }

        try {
            return $this->gate->forUser($user)->allows($ability);
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function route(string $name, array $parameters = []): string
    {
        try {
            return $this->urlGenerator->route($name, $parameters, false);
        } catch (Throwable) {
            return '#';
        }
    }

    /**
     * Nav rows for every registered content type EXCEPT the hardcoded
     * `post` / `page` (see #106): those two ship with bespoke admin
     * screens (visual editor + featured image) and are already surfaced
     * as first-class items above. Every other registered type — DB or
     * plugin — gets a row pointing at the generic
     * `admin.content.{contentType}.index` route.
     *
     * The manager isn't a constructor dependency because the framework's
     * ContentTypes provider may bind it after this builder has been
     * resolved for a request that runs before install. Missing binding →
     * empty list; missing table (fresh install) → empty list.
     *
     * @return list<array<string, mixed>>
     */
    private function dynamicContentTypeItems(): array
    {
        if (! $this->container->bound(ContentTypeManager::class)) {
            return [];
        }

        try {
            /** @var ContentTypeManager $manager */
            $manager    = $this->container->make(ContentTypeManager::class);
            $registered = $manager->getRegisteredContentTypes();
        } catch (Throwable) {
            return [];
        }

        $items = [];

        foreach ($registered as $slug => $entry) {
            $entrySlug = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;
            if (SpecializedContentTypes::contains($entrySlug)) {
                continue;
            }
            if (is_array($entry) && false === ($entry['show_in_admin'] ?? true)) {
                continue;
            }

            $label = is_array($entry) ? (string) ($entry['name'] ?? $entrySlug) : $entrySlug;
            try {
                $indexUrl  = $this->urlGenerator->route('admin.content.index', ['contentType' => $entrySlug], false);
                // #184 — "Add …" opens the Add-New modal via the
                // Index page's `?new=1` query flag; the killed
                // `admin.content.create` auto-draft route is gone.
                $createUrl = $this->urlGenerator->route('admin.content.index', ['contentType' => $entrySlug, 'new' => 1], false);
            } catch (Throwable) {
                continue;
            }
            $items[] = [
                'key'      => 'content-type-'.$entrySlug,
                'label'    => $label,
                'iconId'   => is_array($entry) && ! empty($entry['icon']) ? (string) $entry['icon'] : 'pages',
                'url'      => $indexUrl,
                'children' => [
                    ['key' => 'content-type-'.$entrySlug.'-all', 'label' => 'All '.$label, 'url' => $indexUrl],
                    ['key' => 'content-type-'.$entrySlug.'-new', 'label' => 'Add '.Str::singular($label), 'url' => $createUrl],
                ],
            ];
        }

        return $items;
    }
}
