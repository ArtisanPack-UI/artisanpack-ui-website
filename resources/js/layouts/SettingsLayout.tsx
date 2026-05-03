import type { ReactNode } from 'react';
import { Link } from '@inertiajs/react';
import AppLayout from './AppLayout';

const TABS = [
    { href: '/settings/profile', label: 'Profile' },
    { href: '/settings/password', label: 'Password' },
    { href: '/settings/appearance', label: 'Appearance' },
];

export interface SettingsLayoutProps {
    children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    return (
        <AppLayout>
            <div className="max-w-5xl mx-auto p-6 flex flex-col md:flex-row gap-8">
                <aside className="w-full md:w-56 shrink-0">
                    <ul className="menu bg-base-100 rounded-box shadow w-full">
                        {TABS.map((tab) => (
                            <li key={tab.href}>
                                <Link
                                    href={tab.href}
                                    className={currentPath === tab.href ? 'menu-active' : ''}
                                >
                                    {tab.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </aside>
                <section className="flex-1 space-y-6">{children}</section>
            </div>
        </AppLayout>
    );
}
