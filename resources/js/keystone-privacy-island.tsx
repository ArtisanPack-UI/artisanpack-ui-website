import '../css/keystone-privacy-island.css';

import { createRoot } from 'react-dom/client';
// Direct re-export shim rather than the package barrel — see
// `resources/js/lib/vendor/privacy-react.ts` for why.
import {
    CookieBanner,
    ConsentPreferences,
    DataRequestForm,
    PrivacyDashboard,
} from '@/lib/vendor/privacy-react';

const MOUNT_ID = 'keystone-privacy-banner-root';
const PREFS_TRIGGER_SELECTOR = '[data-privacy-preferences-trigger]';

/**
 * Public-facing cookie banner + preferences modal. Reads the active
 * theme's `--wp--preset--color--*` variables through
 * `resources/css/keystone-privacy-island.css` so the surface picks up
 * whatever palette the current theme published — no per-theme code
 * needed.
 *
 * Consent state is proxied through the package's `useConsent` hook,
 * which speaks to the JSON API registered by `PrivacyServiceProvider`
 * at `/api/privacy/*`.
 *
 * Themes (and visual-editor blocks) can render an anchor with
 * `data-privacy-preferences-trigger` to reopen the preferences modal
 * — e.g. a "Cookie preferences" link in the footer.
 */
function KeystonePrivacySurface() {
    return (
        <>
            <CookieBanner
                className="keystone-privacy-banner"
                header={
                    <div className="keystone-privacy-banner__header">
                        Your privacy choices
                    </div>
                }
                description={
                    <p className="keystone-privacy-banner__description">
                        We use cookies to keep this site working, to remember your
                        preferences, and — if you allow it — to measure how the site
                        performs. Necessary cookies are always on.
                    </p>
                }
                acceptLabel="Accept all"
                rejectLabel="Reject non-essential"
                customiseLabel="Customise"
                saveLabel="Save preferences"
            />
        </>
    );
}

function mountBanner() {
    // Prefer the mount div the InjectPrivacyBanner middleware inlined
    // before </body> so we hydrate an already-placed element rather than
    // fighting the server for it. Fall back to creating one for pages the
    // middleware doesn't touch (e.g. Inertia partial reloads that lose the
    // parent HTML frame between navigations) and to keep hot reload alive
    // in dev.
    let mount = document.getElementById(MOUNT_ID);
    if (mount?.dataset.keystonePrivacyMounted === 'true') {
        return;
    }
    if (!mount) {
        mount = document.createElement('div');
        mount.id = MOUNT_ID;
        document.body.appendChild(mount);
    }
    mount.dataset.keystonePrivacyMounted = 'true';

    createRoot(mount).render(<KeystonePrivacySurface />);
}

function mountPreferencesTriggers() {
    const modalId = 'keystone-privacy-preferences-modal';

    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }
        const trigger = target.closest<HTMLElement>(PREFS_TRIGGER_SELECTOR);
        if (!trigger) {
            return;
        }
        event.preventDefault();

        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'keystone-privacy-banner';
            modal.style.maxWidth = '32rem';
            document.body.appendChild(modal);
            createRoot(modal).render(
                <ConsentPreferences
                    className=""
                    saveLabel="Save preferences"
                />,
            );
        }
        modal.style.display = 'block';
    });
}

/**
 * Hydrate the three visual-editor DSR blocks emitted by
 * `App\VisualEditor\Blocks\{ConsentHistory,DsrRequest,DsrStatus}Block`.
 * Each block's server-rendered `<div data-privacy-block="…">` is
 * replaced by the corresponding package React component. Guards against
 * double-mounting so an in-editor preview refresh stays idempotent.
 */
function mountDsrBlocks() {
    document
        .querySelectorAll<HTMLElement>('[data-privacy-block]:not([data-privacy-block-mounted])')
        .forEach((el) => {
            el.dataset.privacyBlockMounted = 'true';
            const kind = el.dataset.privacyBlock;
            const root = createRoot(el);

            if (kind === 'consent-history') {
                root.render(<ConsentPreferences />);
                return;
            }
            if (kind === 'dsr-request') {
                root.render(<DataRequestForm />);
                return;
            }
            if (kind === 'dsr-status') {
                root.render(<PrivacyDashboard />);
                return;
            }
        });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        mountBanner();
        mountPreferencesTriggers();
        mountDsrBlocks();
    });
} else {
    mountBanner();
    mountPreferencesTriggers();
    mountDsrBlocks();
}
