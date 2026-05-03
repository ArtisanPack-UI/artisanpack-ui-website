import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { usePage } from '@inertiajs/react';
import { ToastProvider, useToast, type ToastProviderProps } from '@artisanpack-ui/react/feedback';

// Local copy of @artisanpack-ui/react-laravel's InertiaToastProvider that
// avoids the upstream root-import bug (the published adapter v1.0.0 does
// `import { ToastProvider } from '@artisanpack-ui/react'`, which pulls in
// the chart barrel and demands the missing react-apexcharts peer).
// Once the adapter ships subpath imports we can switch back.

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

function FlashListener() {
    const page = usePage<SharedProps>();
    const flash = useMemo<FlashMessages>(() => page.props.flash ?? {}, [page.props.flash]);
    const toast = useToast();
    const shown = useRef<string | null>(null);

    const flashKey = JSON.stringify(flash) + page.url;

    useEffect(() => {
        if (shown.current === flashKey) return;
        shown.current = flashKey;

        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
        if (flash.warning) toast.warning(flash.warning);
        if (flash.info) toast.info(flash.info);
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
