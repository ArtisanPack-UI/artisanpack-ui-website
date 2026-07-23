/**
 * Vendor JSON API paths for the artisanpack-ui/performance admin routes.
 *
 * Wayfinder only generates types for Keystone's own Laravel routes — it
 * can't generate types for a vendored package's route registration — so
 * these paths are hand-authored here. Kept in one file so a package
 * upgrade that renames a path only requires one edit instead of a
 * fetch-site hunt. Paths mirror
 * `vendor/artisanpack-ui/performance/routes/api-admin.php` under the
 * `api_prefix` from `config/artisanpack/performance.php`, which
 * `HandleInertiaRequests::share()` publishes as
 * `keystone.performance.api_prefix` — override
 * `PERF_ROUTES_API_PREFIX` on the server and both the vendor's route
 * registration and these fetchers pick up the new prefix without a
 * client rebuild.
 */

const FALLBACK_PREFIX = '/api/performance';

function prefix(): string {
    if (typeof document === 'undefined') {
        return FALLBACK_PREFIX;
    }
    try {
        const raw = document.getElementById('app')?.dataset.page;
        const shared = raw
            ? (JSON.parse(raw) as {
                  props?: { keystone?: { performance?: { api_prefix?: string } } };
              })
            : null;
        const configured = shared?.props?.keystone?.performance?.api_prefix;
        if (typeof configured === 'string' && configured !== '') {
            return configured.replace(/\/+$/, '');
        }
    } catch {
        // Fall through to the default. A malformed data-page attribute
        // is far less common than a missing one; either way, hard-coding
        // the package default is safer than surfacing an error on every
        // admin fetch.
    }
    return FALLBACK_PREFIX;
}

export const performanceApi = {
    admin: {
        dashboard: () => `${prefix()}/admin/dashboard`,
        chart: () => `${prefix()}/admin/chart`,
        queries: () => `${prefix()}/admin/queries`,
        queriesExport: () => `${prefix()}/admin/queries/export`,
        cache: () => `${prefix()}/admin/cache`,
        cacheActions: () => `${prefix()}/admin/cache/actions`,
        recommendations: () => `${prefix()}/admin/recommendations`,
        recommendationsActions: () => `${prefix()}/admin/recommendations/actions`,
    },
} as const;
