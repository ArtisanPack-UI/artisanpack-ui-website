import type { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import { InertiaToastProvider } from '@/lib/InertiaToastProvider';
import { AppLogo } from '@/components/AppLogo';

export interface AuthLayoutProps {
    children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
    return (
        <InertiaToastProvider>
            <main className="min-h-screen bg-base-200 flex flex-col items-center justify-center p-6 gap-6">
                <Link href="/" className="no-underline">
                    <AppLogo className="text-lg" />
                </Link>
                <div className="w-full max-w-md">{children}</div>
            </main>
        </InertiaToastProvider>
    );
}
