import { useEffect } from 'react';
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
    }, [effectiveScheme]);

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
 */
export function useAdminPalette(palette: KeystoneAdminTheme): void {
    const { primaryColor, secondaryColor, accentColor } = palette;

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const root = document.documentElement;
        const overrides: Array<[string, string | null]> = [
            ['--color-primary', primaryColor],
            ['--color-secondary', secondaryColor],
            ['--color-accent', accentColor],
            ['--chrome-active-fg', accentColor],
        ];

        for (const [property, value] of overrides) {
            if (value === null) {
                root.style.removeProperty(property);
            } else {
                root.style.setProperty(property, value);
            }
        }

        // Drop the inline overrides on unmount so the palette can't leak onto
        // non-admin pages — the daisyUI stylesheet values take over again.
        return () => {
            for (const [property] of overrides) {
                root.style.removeProperty(property);
            }
        };
    }, [primaryColor, secondaryColor, accentColor]);
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
