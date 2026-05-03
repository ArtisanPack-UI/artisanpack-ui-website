import { useState, type ReactNode } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { Sidebar, Navbar } from '@artisanpack-ui/react/navigation';
import { Icon } from '@artisanpack-ui/react/utility';
import { InertiaToastProvider } from '@/lib/InertiaToastProvider';
import { AppLogo, AppLogoIcon } from '@/components/AppLogo';

const MENU_ICON = 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5';
const LOGOUT_ICON =
    'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75';

interface AuthUser {
    name: string;
    email: string;
}

interface SharedProps {
    auth: { user: AuthUser | null };
    [key: string]: unknown;
}

interface NavItem {
    label: string;
    href: string;
}

const NAV: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Settings', href: '/settings/profile' },
];

function isActive(currentPath: string, href: string) {
    if (href === '/dashboard') return currentPath === '/dashboard';
    return currentPath.startsWith(href.replace(/\/profile$/, ''));
}

function SidebarContent({
    user,
    currentPath,
    onNavigate,
}: {
    user: AuthUser | null;
    currentPath: string;
    onNavigate: () => void;
}) {
    return (
        <div className="flex flex-col h-full gap-4">
            <div className="px-2 pt-2">
                <AppLogo />
            </div>

            <ul className="menu menu-md w-full p-0 flex-1">
                {NAV.map((item) => (
                    <li key={item.href}>
                        <Link
                            href={item.href}
                            onClick={onNavigate}
                            className={isActive(currentPath, item.href) ? 'menu-active' : ''}
                        >
                            {item.label}
                        </Link>
                    </li>
                ))}
            </ul>

            {user && (
                <div className="border-t border-base-300 pt-3 px-2">
                    <div className="flex items-center gap-3">
                        <div className="avatar avatar-placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-8">
                                <span className="text-xs">{user.name.charAt(0).toUpperCase()}</span>
                            </div>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{user.name}</div>
                            <div className="text-xs text-base-content/60 truncate">
                                {user.email}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.post('/logout')}
                            className="btn btn-ghost btn-sm btn-square"
                            aria-label="Log out"
                            title="Log out"
                        >
                            <Icon path={LOGOUT_ICON} size="sm" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export interface AppLayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const { auth } = usePage<SharedProps>().props;
    const [open, setOpen] = useState(false);
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

    return (
        <InertiaToastProvider>
            <Sidebar
                open={open}
                onOpenChange={setOpen}
                width="w-72"
                className="lg:drawer-open"
                sidebarContent={
                    <SidebarContent
                        user={auth.user}
                        currentPath={currentPath}
                        onNavigate={() => setOpen(false)}
                    />
                }
            >
                <div className="min-h-screen flex flex-col bg-base-200">
                    <Navbar
                        className="lg:hidden"
                        start={
                            <button
                                type="button"
                                onClick={() => setOpen(true)}
                                className="btn btn-ghost btn-square"
                                aria-label="Open menu"
                            >
                                <Icon path={MENU_ICON} />
                            </button>
                        }
                        end={<AppLogoIcon />}
                    />

                    <main className="flex-1">{children}</main>
                </div>
            </Sidebar>
        </InertiaToastProvider>
    );
}
