import { useEffect, type ReactNode } from 'react';
import { Link, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card } from '@/components/admin/keystone';
import admin from '@/routes/admin';
import { acquireAdminMarker, releaseAdminMarker } from '@/lib/admin/progress';

const TABS = [
    { href: admin.privacy.consents().url, label: 'Consent Manager' },
    { href: admin.privacy.dataRequests().url, label: 'Data Subject Requests' },
    { href: admin.privacy.breaches().url, label: 'Breach Manager' },
    { href: admin.privacy.reports().url, label: 'Compliance Reports' },
];

export interface PrivacyAdminLayoutProps {
    children: ReactNode;
}

/**
 * Sub-nav wrapper for the four top-level Privacy admin screens. Matches
 * the shape of `SettingsLayout` so the two feel like part of the same
 * admin surface.
 */
export default function PrivacyAdminLayout({ children }: PrivacyAdminLayoutProps) {
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
                            <nav aria-label="Privacy sections">
                                <ul className="flex flex-col p-1.5">
                                    {TABS.map((tab) => {
                                        const active =
                                            currentPath === tab.href ||
                                            (tab.href !== admin.privacy.consents().url &&
                                                currentPath.startsWith(tab.href));
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
