/**
 * Narrow re-export of the artisanpack-ui/privacy React components Keystone
 * actually mounts (the public banner + user-facing DSR block companions).
 *
 * The package's `./react` barrel also exports its Livewire-facing Admin/*
 * components. Two of those have known upstream typing bugs that would
 * cascade into `tsc --noEmit` any time we import from the barrel — a
 * `Record<string, unknown>` cast on a union type in ComplianceReport, and
 * an `unknown → ReactNode` render in BreachDetail. We don't render either
 * one from Keystone (we build our own Inertia/React admin, see
 * PrivacyAdminController + admin/privacy/*), so importing them
 * transitively just to have TypeScript check dead code isn't worth the
 * CI failure.
 *
 * Re-exporting the four we DO use from individual vendor files keeps
 * TypeScript from ever opening the Admin subtree. Vite still resolves
 * `@artisanpack-ui/privacy/react` normally at bundle time; this shim only
 * changes what the type-checker traverses.
 *
 * Remove this file (and revert `keystone-privacy-island` back to
 * importing from `@artisanpack-ui/privacy/react`) once the upstream Admin
 * files are green under strict TS.
 */

export { CookieBanner } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/CookieBanner';
export type { CookieBannerProps } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/CookieBanner';

export { ConsentPreferences } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/ConsentPreferences';
export type { ConsentPreferencesProps } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/ConsentPreferences';

export { DataRequestForm } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/DataRequestForm';
export type { DataRequestFormProps } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/DataRequestForm';

export { PrivacyDashboard } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/PrivacyDashboard';
export type { PrivacyDashboardProps } from '../../../../vendor/artisanpack-ui/privacy/resources/js/react/PrivacyDashboard';
