import { useEffect } from 'react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { useTheme } from '@artisanpack-ui/react';
import type { KeystoneAdminTheme } from '@/types/keystone';

export const STORAGE_KEY = 'jmwd-keystone-admin.theme';

/**
 * Sync the admin daisyUI theme (`data-theme`) with the resolved color scheme,
 * and persist the user's choice. When `forceTheme` is `light` or `dark` the
 * admin is pinned to that scheme regardless of the per-user/browser
 * preference; `system` (the default) keeps the resolved preference.
 */
export function useThemeSync(forceTheme: KeystoneAdminTheme['forceTheme'] = 'system'): void {
    const { colorScheme, resolvedColorScheme } = useTheme();
    const effectiveScheme = forceTheme === 'system' ? resolvedColorScheme : forceTheme;

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }
        document.documentElement.dataset.theme =
            effectiveScheme === 'dark' ? 'keystone-dark' : 'keystone-light';
        // Fire `keystone.admin.theme.change` after the DOM data-theme has
        // been stamped so any subscriber that reads computed styles gets
        // the post-flip snapshot. Args: `(effectiveScheme, { colorScheme,
        // resolvedColorScheme, forceTheme })` — the extra context lets a
        // subscriber tell "user toggled" from "system flipped" apart.
        //
        // Guarded: `doAction` runs synchronously inside the effect; the
        // hooks-js primitive does not isolate throws, so an unwrapped
        // subscriber failure would abort the effect and leave later
        // effect cleanup / dependent state out of sync.
        try {
            doAction('keystone.admin.theme.change', effectiveScheme, {
                colorScheme,
                resolvedColorScheme,
                forceTheme,
            });
        } catch (error) {
            console.error('[keystone] subscriber of keystone.admin.theme.change threw:', error);
        }
    }, [effectiveScheme, colorScheme, resolvedColorScheme, forceTheme]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, colorScheme);
    }, [colorScheme]);
}

/**
 * Apply the admin brand palette to the admin chrome by overriding the daisyUI
 * theme tokens (`--color-primary/secondary/accent`) and the sidebar accent
 * (`--chrome-active-fg`) on the document root. Null values are left untouched
 * so the built-in theme default stands. Admin-only — the public site is themed
 * by the visual site editor.
 *
 * The variant pick uses `useTheme()` directly rather than observing
 * `data-theme` — `useThemeSync` writes that attribute from the same primitive,
 * so reading the source here avoids a DOM round-trip and keeps the pick in the
 * same render as `useThemeSync`'s scheme resolution. The sidebar
 * `--chrome-active-fg` always uses the dark-clamped accent because chrome is
 * dark-surfaced in BOTH themes (see `[data-theme='keystone-*']` blocks in
 * `resources/css/app.css`). WCAG contrast enforcement lives on the server
 * (`AdminTheme::clampForContrast()`); the client trusts the pre-clamped
 * `*Color` / `*ColorDark` variants it receives via shared props.
 */
export function useAdminPalette(palette: KeystoneAdminTheme): void {
    const {
        primaryColor,
        primaryColorDark,
        secondaryColor,
        secondaryColorDark,
        accentColor,
        accentColorDark,
        forceTheme,
    } = palette;
    const { resolvedColorScheme } = useTheme();
    const effectiveScheme = forceTheme === 'system' ? resolvedColorScheme : forceTheme;
    const isDark = effectiveScheme === 'dark';

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        // Plugins can rewrite the CSS custom-property token map before it's
        // stamped on the document root via `keystone.admin.theme.tokens`.
        // Args: `(Record<string, string | null>)`; return the (possibly
        // mutated) map. Setting a property to `null` removes any inline
        // override. Runs on every palette-change effect fire so filter
        // callbacks bound after mount pick up on the next brand save.
        //
        // Guarded: a throwing subscriber would abort the effect before
        // the palette gets applied AND before the cleanup registration
        // below; on unmount the inline overrides would then leak.
        const baseTokens: Record<string, string | null> = {
            '--color-primary':    isDark ? primaryColorDark   : primaryColor,
            '--color-secondary':  isDark ? secondaryColorDark : secondaryColor,
            '--color-accent':     isDark ? accentColorDark    : accentColor,
            '--chrome-active-fg': accentColorDark,
        };
        let filteredTokens: Record<string, string | null>;
        try {
            filteredTokens = applyFilters<Record<string, string | null>>(
                'keystone.admin.theme.tokens',
                baseTokens,
            );
        } catch (error) {
            console.error('[keystone] subscriber of keystone.admin.theme.tokens threw:', error);
            filteredTokens = baseTokens;
        }

        const root = document.documentElement;
        const properties = Object.keys(filteredTokens);

        for (const property of properties) {
            const value = filteredTokens[property];
            if (null === value) {
                root.style.removeProperty(property);
            } else {
                root.style.setProperty(property, value);
            }
        }

        // Drop the inline overrides on unmount so the palette can't leak onto
        // non-admin pages — the daisyUI stylesheet values take over again.
        return () => {
            for (const property of properties) {
                root.style.removeProperty(property);
            }
        };
    }, [
        primaryColor,
        primaryColorDark,
        secondaryColor,
        secondaryColorDark,
        accentColor,
        accentColorDark,
        isDark,
    ]);
}

export interface ChartTheme {
    isDark: boolean;
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    gridline: string;
    axisLabel: string;
    tooltipBg: string;
}

export function useChartTheme(): ChartTheme {
    const { resolvedColorScheme } = useTheme();
    const isDark = resolvedColorScheme === 'dark';

    return {
        isDark,
        primary: isDark ? '#3b82f6' : '#0855b1',
        secondary: isDark ? '#0855b1' : '#010e54',
        accent: '#04d9ff',
        success: isDark ? '#22c55e' : '#16a34a',
        warning: isDark ? '#fbbf24' : '#f59e0b',
        danger: isDark ? '#f87171' : '#dc2626',
        gridline: isDark ? '#1e293b' : '#e2e8f0',
        axisLabel: isDark ? '#94a3b8' : '#64748b',
        tooltipBg: isDark ? '#0b1220' : '#ffffff',
    };
}

export function formatCurrency(value: number, options: Intl.NumberFormatOptions = {}): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
        ...options,
    }).format(value);
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
    return `${value > 0 ? '+' : ''}${value.toFixed(fractionDigits)}%`;
}

export function formatRelativeTime(isoString: string): string {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.round(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString: string): string {
    return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export function initialsOf(name: string): string {
    if (name === 'System') {
        return 'SY';
    }
    return name
        .split(' ')
        .map((s) => s[0] ?? '')
        .slice(0, 2)
        .join('');
}
