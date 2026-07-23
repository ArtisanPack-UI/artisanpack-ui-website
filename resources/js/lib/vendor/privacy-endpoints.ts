/**
 * Vendor JSON API paths for the artisanpack-ui/privacy admin routes.
 *
 * Wayfinder only knows about Keystone's own Laravel routes — it can't
 * generate types for a vendored package's route registration — so these
 * paths are hand-authored here. Kept in one file so a package upgrade
 * that renames a path only requires one edit instead of a fetch-site
 * hunt. Paths mirror `vendor/artisanpack-ui/privacy/routes/api.php`
 * under the `api_prefix` from `config/artisanpack/privacy.php`, which
 * `HandleInertiaRequests::share()` publishes as
 * `keystone.privacy.api_prefix` — override
 * `PRIVACY_ROUTES_API_PREFIX` on the server and both the vendor's
 * route registration and these fetchers pick up the new prefix
 * without a client rebuild.
 */

const FALLBACK_PREFIX = '/api/privacy';

function prefix(): string {
    if (typeof document === 'undefined') {
        return FALLBACK_PREFIX;
    }
    try {
        const raw = document.getElementById('app')?.dataset.page;
        const shared = raw
            ? (JSON.parse(raw) as {
                  props?: { keystone?: { privacy?: { api_prefix?: string } } };
              })
            : null;
        const configured = shared?.props?.keystone?.privacy?.api_prefix;
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

export const privacyApi = {
    admin: {
        consents: () => `${prefix()}/admin/consents`,
        dataRequests: () => `${prefix()}/admin/data-requests`,
        dataRequestAction: (id: number | string) =>
            `${prefix()}/admin/data-requests/${id}/actions`,
        breaches: () => `${prefix()}/admin/breaches`,
        complianceReport: () => `${prefix()}/admin/compliance-report`,
    },
} as const;
