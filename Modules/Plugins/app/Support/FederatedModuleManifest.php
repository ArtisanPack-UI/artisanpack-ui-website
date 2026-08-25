<?php

declare(strict_types=1);

namespace Modules\Plugins\Support;

use Modules\Plugins\Services\PluginUpdateUrlGuard;

/**
 * Builds the client-side federated-module lookup table the Inertia resolver
 * consults when a requested page isn't part of the build-time
 * {@see resources/js/app.tsx `import.meta.glob`} scan.
 *
 * The framework's PluginRegistry stores federated modules keyed by remote
 * name — e.g. `hello-world` → `['entry' => 'https://…/remoteEntry.js',
 * 'exposes' => ['./dashboard', './settings']]`. The resolver, however, is
 * called with an Inertia page name like `plugins/hello-world/dashboard`.
 * This class transforms the registry-shaped payload emitted by the
 * `ap.plugins.federatedModules` filter into a page-name-keyed map so the
 * resolver can do a single O(1) lookup and hand off to the federated
 * loader.
 *
 * Output shape:
 *
 *     [
 *         'pages' => [
 *             'plugins/hello-world/dashboard' => [
 *                 'remote' => 'hello-world',
 *                 'entry'  => 'https://…/remoteEntry.js',
 *                 'module' => './dashboard',
 *             ],
 *             …
 *         ],
 *         'bootModules' => [
 *             [
 *                 'remote' => 'hello-world',
 *                 'entry'  => 'https://…/remoteEntry.js',
 *                 'module' => './boot',
 *             ],
 *             …
 *         ],
 *     ]
 *
 * `pages` is consumed by the Inertia resolver to hand off unknown page names
 * to the federation runtime. `bootModules` is preloaded by the app shell
 * BEFORE the first page mounts so plugin-registered hook callbacks
 * (`addAction`/`addFilter` in the boot module's top-level side effects) bind
 * before the shell reads them via `applyFilters`.
 *
 * Trust boundary: descriptors come from active plugins whose code
 * ostensibly ran in-process to register with the framework, but a plugin
 * ZIP could still ship a malicious `entry` URL, or a compromised
 * `plugin.json` on disk could push one into the registry. The build
 * defends by:
 *
 *   - Requiring the `entry` URL to pass {@see PluginUpdateUrlGuard}
 *     (https scheme, no loopback/link-local/RFC1918 hosts, optional
 *     hostname allowlist) so a poisoned descriptor can't reach the
 *     browser's dynamic-import as an arbitrary attacker-hosted script.
 *   - Rejecting `remote` / `exposed` values containing `/`, `..`, or
 *     other path segments so the derived Inertia page name can't
 *     collide with a host route or a sibling plugin's page.
 *
 * Rejected descriptors are DROPPED from the client manifest; the plugin
 * simply has no federated pages. The framework's own manifest ingestion
 * is still trusted for shape (`entry`/`exposes` types), so those are
 * best-effort defended here too.
 */
class FederatedModuleManifest
{
    public function __construct(
        private readonly PluginUpdateUrlGuard $urlGuard,
    ) {}

    /**
     * Transform the raw `ap.plugins.federatedModules` filter payload into the
     * page/boot manifest the client shell consumes.
     *
     * @param  array<string, array{entry?: mixed, exposes?: mixed, bootModule?: mixed}>  $registry
     *
     * @return array{
     *     pages: array<string, array{remote: string, entry: string, module: string}>,
     *     bootModules: list<array{remote: string, entry: string, module: string}>,
     * }
     */
    public function build(array $registry): array
    {
        $pages       = [];
        $bootModules = [];

        foreach ($registry as $remote => $descriptor) {
            if (! is_string($remote) || '' === $remote || ! $this->isSafeIdentifier($remote)) {
                continue;
            }

            // A plugin subscribing to `ap.plugins.federatedModules` could
            // shove a scalar into the map — indexing a scalar throws in
            // PHP 8 and would break every admin Inertia response.
            if (! is_array($descriptor)) {
                continue;
            }

            $entry      = $descriptor['entry'] ?? null;
            $exposes    = $descriptor['exposes'] ?? [];
            $bootModule = $descriptor['bootModule'] ?? null;

            if (! is_string($entry) || '' === $entry || ! $this->urlGuard->isAllowed($entry)) {
                continue;
            }

            if (! is_array($exposes)) {
                continue;
            }

            foreach ($exposes as $exposed) {
                if (! is_string($exposed) || '' === $exposed) {
                    continue;
                }

                $normalized = $this->normalizeExposedName($exposed);

                if (null === $normalized || ! $this->isSafeIdentifier($normalized)) {
                    continue;
                }

                $pages[sprintf('plugins/%s/%s', $remote, $normalized)] = [
                    'remote' => $remote,
                    'entry'  => $entry,
                    'module' => $exposed,
                ];
            }

            // A plugin declares its `bootModule` as the exposed module id it
            // wants preloaded (e.g. `./boot`). It does NOT need to also be
            // listed in `exposes` — boot modules are side-effect-only, not
            // page components, so the Inertia resolver never asks for them
            // by page name. We still validate the shape and guard against
            // path-traversal in the derived remote name.
            if (is_string($bootModule) && '' !== $bootModule) {
                $bootModules[] = [
                    'remote' => $remote,
                    'entry'  => $entry,
                    'module' => $bootModule,
                ];
            }
        }

        return [
            'pages'       => $pages,
            'bootModules' => $bootModules,
        ];
    }

    /**
     * Strip the leading `./` and a trailing source extension from an exposed
     * module id, returning null if the shape is unrecognisable.
     */
    private function normalizeExposedName(string $exposed): ?string
    {
        $normalized = preg_replace('#^\./#', '', $exposed);
        $normalized = preg_replace('/\.(tsx|jsx|ts|js)$/i', '', (string) $normalized);

        $normalized = ltrim((string) $normalized, '/');

        return '' === $normalized ? null : $normalized;
    }

    /**
     * A remote name or a normalized exposed name is only allowed to contain
     * ASCII letters, digits, dash, underscore, and dot — no path separators,
     * no `..` traversal segments, and no whitespace or control characters
     * that could later be interpreted as a route segment.
     */
    private function isSafeIdentifier(string $value): bool
    {
        if (1 !== preg_match('/^[A-Za-z0-9._-]+$/', $value)) {
            return false;
        }

        // A single `.` or `..` segment (or one containing `..`) can pivot the
        // derived page name against a path-normalising consumer, so refuse
        // any bare traversal token.
        foreach (explode('.', $value) as $segment) {
            if ('.' === $segment || '..' === $segment) {
                return false;
            }
        }

        return ! str_contains($value, '..');
    }
}
