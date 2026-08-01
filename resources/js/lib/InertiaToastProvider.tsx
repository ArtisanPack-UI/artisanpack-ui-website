import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { ToastProvider, useToast, type ToastProviderProps } from '@artisanpack-ui/react/feedback';

// Local copy of @artisanpack-ui/react-laravel's InertiaToastProvider that
// avoids the upstream root-import bug (the published adapter v1.0.0 does
// `import { ToastProvider } from '@artisanpack-ui/react'`, which pulls in
// the chart barrel and demands the missing react-apexcharts peer).
// Once the adapter ships subpath imports we can switch back.

export type ToastLevel = 'success' | 'error' | 'warning' | 'info';

export interface ToastEmitPayload {
    level:   ToastLevel;
    message: string;
    /** Where the toast originated — `'flash'` for Inertia flash pipeline, `'imperative'` otherwise. */
    source:  'flash' | 'imperative';
}

interface FlashMessages {
    success?: string;
    error?: string;
    warning?: string;
    info?: string;
}

interface SharedProps {
    flash?: FlashMessages;
    [key: string]: unknown;
}

/**
 * Route a toast through the `keystone.admin.toast.emit` filter (with veto),
 * then — if it survives — call the underlying `useToast()` method and fire
 * `keystone.admin.toast.emitted`.
 *
 * Veto contract: a filter callback returning literal `false` suppresses the
 * toast entirely. Any other return value (including undefined / a mutated
 * payload) is treated as "keep going" and passed to the next callback.
 * Return a mutated payload to rewrite the message or bump the level.
 */
function emitFilteredToast(
    toast: ReturnType<typeof useToast>,
    payload: ToastEmitPayload,
): void {
    const filtered = applyFilters<ToastEmitPayload | false>('keystone.admin.toast.emit', payload);
    if (false === filtered) {
        return;
    }

    // A filter callback that mangled the shape into something non-object is
    // treated as a veto too — better than trying to invoke `toast[level]`
    // with a garbage `level`.
    if (null === filtered || 'object' !== typeof filtered || 'string' !== typeof filtered.message) {
        return;
    }

    switch (filtered.level) {
        case 'success': toast.success(filtered.message); break;
        case 'error':   toast.error(filtered.message);   break;
        case 'warning': toast.warning(filtered.message); break;
        case 'info':    toast.info(filtered.message);    break;
        default: return;
    }

    doAction('keystone.admin.toast.emitted', filtered);
}

function FlashListener() {
    const page = usePage<SharedProps>();
    // Plugins can rewrite the flash payload (redact PII, reformat the
    // message, translate) before it hits the toast filter chain via
    // `keystone.admin.flash`.
    const flash = useMemo<FlashMessages>(
        () => {
            const filtered = applyFilters<FlashMessages | null | undefined>(
                'keystone.admin.flash',
                page.props.flash ?? {},
            );
            // A subscriber returning `null` / `undefined` would crash
            // the `flash.success`-style access below on every
            // navigation; treat nullish returns as "no flash".
            return null == filtered ? {} : filtered;
        },
        [page.props.flash],
    );
    const toast = useToast();
    const shown = useRef<string | null>(null);

    const flashKey = JSON.stringify(flash) + page.url;

    useEffect(() => {
        if (shown.current === flashKey) return;
        shown.current = flashKey;

        if (flash.success) emitFilteredToast(toast, { level: 'success', message: flash.success, source: 'flash' });
        if (flash.error)   emitFilteredToast(toast, { level: 'error',   message: flash.error,   source: 'flash' });
        if (flash.warning) emitFilteredToast(toast, { level: 'warning', message: flash.warning, source: 'flash' });
        if (flash.info)    emitFilteredToast(toast, { level: 'info',    message: flash.info,    source: 'flash' });
    }, [flashKey, flash, toast]);

    return null;
}

export interface InertiaToastProviderProps extends ToastProviderProps {
    children: ReactNode;
}

export function InertiaToastProvider({ children, ...rest }: InertiaToastProviderProps) {
    return (
        <ToastProvider {...rest}>
            <FlashListener />
            {children}
        </ToastProvider>
    );
}
