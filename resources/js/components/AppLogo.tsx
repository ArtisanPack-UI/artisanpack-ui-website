import { usePage } from '@inertiajs/react';

interface SharedProps {
    name: string;
    [key: string]: unknown;
}

export function AppLogoIcon({ className }: { className?: string }) {
    return (
        <span
            className={
                'inline-flex items-center justify-center rounded-md bg-primary text-primary-content font-bold ' +
                (className ?? 'size-8 text-sm')
            }
            aria-hidden="true"
        >
            AP
        </span>
    );
}

export function AppLogo({ className }: { className?: string }) {
    const { name } = usePage<SharedProps>().props;
    return (
        <span className={'inline-flex items-center gap-2 ' + (className ?? '')}>
            <AppLogoIcon />
            <span className="font-semibold">{name}</span>
        </span>
    );
}
