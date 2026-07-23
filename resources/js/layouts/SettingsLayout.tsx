import { useEffect, type ReactNode } from 'react';
import { Link, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from './KeystoneAdminLayout';
import { Card } from '@/components/admin/keystone';
import admin from '@/routes/admin';
import { acquireAdminMarker, releaseAdminMarker } from '@/lib/admin/progress';

const TABS = [
    { href: admin.profile().url, label: 'Profile' },
    { href: admin.password().url, label: 'Password' },
    { href: admin.twoFactor().url, label: 'Two-factor' },
    { href: admin.appearance().url, label: 'Appearance' },
];

export interface SettingsLayoutProps {
    children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
    const currentPath = usePage().url.split('?')[0];

    useEffect(() => {
        acquireAdminMarker();
        return () => releaseAdminMarker();
    }, []);

    return (
        <KeystoneAdminLayout>
            <div className="flex flex-col gap-7">
                <div className="grid grid-cols-12 gap-7">
                    <aside className="col-span-12 lg:col-span-3">
                        <Card padded={false}>
                            <nav aria-label="Settings sections">
                                <ul className="flex flex-col p-1.5">
                                    {TABS.map((tab) => {
                                        const active = currentPath === tab.href;
                                        return (
                                            <li key={tab.href}>
                                                <Link
                                                    href={tab.href}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                                                        active
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'text-base-content/75 hover:bg-base-200'
                                                    }`}
                                                >
                                                    {tab.label}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </nav>
                        </Card>
                    </aside>

                    <section className="col-span-12 flex flex-col gap-5 lg:col-span-9">
                        {children}
                    </section>
                </div>
            </div>
        </KeystoneAdminLayout>
    );
}
