import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { Avatar, useTheme } from '@artisanpack-ui/react';
import admin from '@/routes/admin';
import {
    BrandMark,
    CommandPalette,
    Icon,
    NotificationsBell,
    SearchTrigger,
    ThemeButton,
    type CommandPaletteItem,
} from '@/components/admin/keystone';
import { formatRelativeTime, useAdminPalette, useThemeSync } from '@/lib/admin/shared';
import {
    fetchNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '@/lib/admin/notificationsApi';
import { acquireAdminMarker, releaseAdminMarker } from '@/lib/admin/progress';
import type {
    AdminMenu,
    AdminMenuChild,
    AdminMenuItem,
    KeystoneSharedProps,
    NotificationItem,
} from '@/types/keystone';

const NOTIFICATIONS_POLL_INTERVAL_MS = 30_000;

interface NavItem {
    key: string;
    label: string;
    href: string;
    icon: ReactNode;
    badge?: number;
    children?: NavChild[];
    /**
     * Render as a plain `<a>` (full-page navigation) instead of an
     * Inertia `<Link>`. Set for routes that aren't Inertia pages — the
     * site editor serves a plain-blade SPA mount, so an Inertia XHR to
     * it would get a non-Inertia response and render as a broken
     * modal-over-page. From Inertia's perspective such a route is
     * "external".
     */
    external?: boolean;
}

interface NavChild {
    key: string;
    label: string;
    href: string;
    /**
     * Override the path-prefix(es) used to decide whether this child is active.
     * Defaults to `href`. Use this when one nav entry should highlight for a
     * cluster of sibling routes (e.g. the Profile child highlights for any
     * of the personal-settings tabs reached from its tabbed sub-nav).
     */
    matchPrefix?: string | string[];
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

/**
 * Resolve the string `iconId` a menu row carries into the actual `Icon`
 * React element. Falls back to the settings glyph so a plugin subscribing
 * to `ap.admin.menu` with an unknown iconId still renders. Uses `hasOwn`
 * to avoid resolving `constructor` / `__proto__` / `toString` to
 * prototype methods that would crash React on render.
 */
function resolveIcon(iconId: string): ReactNode {
    const map = Icon as Record<string, ReactNode>;
    return Object.hasOwn(map, iconId) ? map[iconId] : Icon.settings;
}

function toNavChild(child: AdminMenuChild): NavChild {
    return {
        key: child.key,
        label: child.label,
        href: child.url,
        ...(child.matchPrefix !== undefined ? { matchPrefix: child.matchPrefix } : {}),
    };
}

function toNavItem(item: AdminMenuItem): NavItem {
    return {
        key: item.key,
        label: item.label,
        href: item.url,
        icon: resolveIcon(item.iconId),
        ...(typeof item.badge === 'number' ? { badge: item.badge } : {}),
        ...(item.external ? { external: true } : {}),
        ...(item.children && item.children.length > 0
            ? { children: item.children.map(toNavChild) }
            : {}),
    };
}

function navGroupsFromAdminMenu(adminMenu: AdminMenu): NavGroup[] {
    return adminMenu.map((group) => ({
        label: group.label,
        items: group.items.map(toNavItem),
    }));
}

function isActive(currentPath: string, href: string): boolean {
    if (href === '/admin') {
        return currentPath === '/admin';
    }
    return currentPath === href || currentPath.startsWith(`${href}/`);
}

interface SidebarProps {
    collapsed: boolean;
    onToggleCollapsed: () => void;
    currentPath: string;
    mobileOpen: boolean;
    onMobileClose: () => void;
    navGroups: NavGroup[];
    brand: KeystoneSharedProps['keystone']['brand'];
}

function Sidebar({
    collapsed,
    onToggleCollapsed,
    currentPath,
    mobileOpen,
    onMobileClose,
    navGroups,
    brand,
}: SidebarProps) {
    // Manual expand/collapse overrides per parent item. Falls back to
    // `sectionActive` so navigating directly to a child route still
    // surfaces the submenu without an explicit click.
    const [manualExpand, setManualExpand] = useState<Record<string, boolean>>({});

    function toggleExpanded(key: string, defaultOpen: boolean) {
        setManualExpand((prev) => {
            const current = key in prev ? prev[key] : defaultOpen;
            return { ...prev, [key]: !current };
        });
    }

    return (
        <>
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-neutral/40 backdrop-blur-sm lg:hidden"
                    onClick={onMobileClose}
                    aria-hidden
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[var(--chrome-border)] bg-[var(--chrome-bg)] text-[var(--chrome-fg)] transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                } ${collapsed ? 'w-[72px]' : 'w-[256px]'}`}
            >
                <div className="flex h-[60px] items-center justify-between border-b border-[var(--chrome-border)] px-4">
                    <BrandMark
                        collapsed={collapsed}
                        name={brand.name}
                        logoUrl={brand.logoUrl}
                        url={brand.url}
                    />
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        className={`hidden h-7 w-7 place-items-center rounded-md text-[var(--chrome-fg-subtle)] hover:bg-[var(--chrome-hover-bg)] hover:text-[var(--chrome-fg)] lg:grid ${
                            collapsed ? 'mx-auto' : ''
                        }`}
                    >
                        {Icon.panelLeft}
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 py-3">
                    {navGroups.map((group) => (
                        <div key={group.label} className="mb-4 last:mb-0">
                            {!collapsed && (
                                <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--chrome-fg-subtle)]">
                                    {group.label}
                                </div>
                            )}
                            {collapsed && <div className="my-2 h-px bg-[var(--chrome-divider)]" />}
                            <ul className="flex flex-col gap-0.5">
                                {group.items.map((item) => {
                                    const parentActive = isActive(currentPath, item.href);
                                    // Child match: pick the most-specific child whose
                                    // href is a path-prefix of currentPath. This
                                    // prevents the bare "All Posts" entry (href
                                    // `/admin/posts`) from highlighting when the
                                    // user is on a more-specific sub-route like
                                    // `/admin/posts/categories`.
                                    const childMatches = (c: NavChild): { length: number } | null => {
                                        const prefixes = Array.isArray(c.matchPrefix)
                                            ? c.matchPrefix
                                            : [c.matchPrefix ?? c.href];
                                        let bestLen = -1;
                                        for (const prefix of prefixes) {
                                            if (
                                                currentPath === prefix ||
                                                currentPath.startsWith(`${prefix}/`)
                                            ) {
                                                bestLen = Math.max(bestLen, prefix.length);
                                            }
                                        }
                                        return bestLen >= 0 ? { length: bestLen } : null;
                                    };
                                    const activeChildKey =
                                        item.children
                                            ?.flatMap((c) => {
                                                const m = childMatches(c);
                                                return m ? [{ child: c, length: m.length }] : [];
                                            })
                                            .reduce<{ child: NavChild; length: number } | null>(
                                                (best, candidate) =>
                                                    best === null || candidate.length > best.length
                                                        ? candidate
                                                        : best,
                                                null,
                                            )?.child.key ?? null;
                                    const sectionActive = parentActive || activeChildKey !== null;
                                    const hasChildren =
                                        item.children !== undefined &&
                                        item.children.length > 0;
                                    const defaultOpen = sectionActive;
                                    const expanded =
                                        item.key in manualExpand
                                            ? manualExpand[item.key]
                                            : defaultOpen;
                                    const showChildren =
                                        !collapsed && hasChildren && expanded;
                                    const parentSharedClasses = `group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                                        sectionActive
                                            ? 'bg-[var(--chrome-active-bg)] text-[var(--chrome-active-fg)]'
                                            : 'text-[var(--chrome-fg-muted)] hover:bg-[var(--chrome-hover-bg)] hover:text-[var(--chrome-fg)]'
                                    } ${collapsed ? 'justify-center' : ''}`;
                                    const iconClasses = sectionActive
                                        ? 'text-[var(--chrome-active-fg)]'
                                        : 'text-[var(--chrome-fg-subtle)] group-hover:text-[var(--chrome-fg)]';
                                    const labelAndBadge = !collapsed && (
                                        <>
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {item.badge ? (
                                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--chrome-badge-bg)] px-1.5 text-[10px] font-semibold text-[var(--chrome-fg-muted)]">
                                                    {item.badge}
                                                </span>
                                            ) : null}
                                            {hasChildren && (
                                                <span
                                                    aria-hidden
                                                    className={`text-base-content/45 transition-transform ${
                                                        expanded ? 'rotate-90' : ''
                                                    }`}
                                                >
                                                    ›
                                                </span>
                                            )}
                                        </>
                                    );
                                    // When the sidebar is collapsed the submenu is hidden,
                                    // so a parent rendered as a toggle button has no visible
                                    // effect and the route becomes unreachable. Render
                                    // parents-with-children as a navigable Link in collapsed
                                    // mode and keep the toggle behavior only when expanded.
                                    const renderAsToggle = hasChildren && !collapsed;
                                    return (
                                        <li key={item.key}>
                                            {renderAsToggle ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        toggleExpanded(item.key, defaultOpen)
                                                    }
                                                    aria-expanded={expanded}
                                                    title={collapsed ? item.label : undefined}
                                                    className={parentSharedClasses}
                                                >
                                                    <span className={iconClasses}>
                                                        {item.icon}
                                                    </span>
                                                    {labelAndBadge}
                                                </button>
                                            ) : item.external ? (
                                                <a
                                                    href={item.href}
                                                    title={collapsed ? item.label : undefined}
                                                    onClick={onMobileClose}
                                                    className={parentSharedClasses}
                                                >
                                                    <span className={iconClasses}>
                                                        {item.icon}
                                                    </span>
                                                    {labelAndBadge}
                                                </a>
                                            ) : (
                                                <Link
                                                    href={item.href}
                                                    title={collapsed ? item.label : undefined}
                                                    onClick={onMobileClose}
                                                    className={parentSharedClasses}
                                                >
                                                    <span className={iconClasses}>
                                                        {item.icon}
                                                    </span>
                                                    {labelAndBadge}
                                                </Link>
                                            )}
                                            {showChildren && (
                                                <ul className="mt-0.5 ml-6 flex flex-col gap-0.5 border-l border-[var(--chrome-divider)] pl-2">
                                                    {item.children!.map((child) => {
                                                        const active =
                                                            child.key === activeChildKey;
                                                        return (
                                                            <li key={child.key}>
                                                                <Link
                                                                    href={child.href}
                                                                    onClick={onMobileClose}
                                                                    className={`block rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                                                                        active
                                                                            ? 'text-[var(--chrome-active-fg)]'
                                                                            : 'text-[var(--chrome-fg-muted)] hover:text-[var(--chrome-fg)]'
                                                                    }`}
                                                                >
                                                                    {child.label}
                                                                </Link>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
                {!collapsed && (
                    <div className="border-t border-[var(--chrome-border)] px-4 py-3 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--chrome-fg-subtle)]">
                        Keystone CMS · v0.1
                    </div>
                )}
            </aside>
        </>
    );
}

function NotificationsPanel({
    notifications,
    onMarkAllRead,
    onMarkOneRead,
    onViewAll,
}: {
    notifications: NotificationItem[];
    onMarkAllRead: () => void;
    onMarkOneRead: (id: number) => void;
    onViewAll: () => void;
}) {
    const grouped = useMemo(() => {
        const byDay: Record<string, NotificationItem[]> = {};
        for (const n of notifications.slice(0, 8)) {
            const day =
                new Date(n.created_at).toDateString() === new Date().toDateString()
                    ? 'Today'
                    : new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            (byDay[day] ||= []).push(n);
        }
        return byDay;
    }, [notifications]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="flex max-h-[70vh] flex-col">
            <div className="flex items-center justify-between border-b border-base-300/60 px-4 py-3">
                <div>
                    <div className="font-display text-sm font-semibold text-base-content">
                        Notifications
                    </div>
                    <div className="text-[11px] text-base-content/55">{unreadCount} unread</div>
                </div>
                {unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="text-xs font-semibold text-primary hover:underline"
                    >
                        Mark all read
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {Object.entries(grouped).map(([day, items]) => (
                    <div key={day}>
                        <div className="bg-base-200/60 px-4 py-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                            {day}
                        </div>
                        <ul>
                            {items.map((n) => (
                                <li key={n.id}>
                                    <button
                                        type="button"
                                        onClick={() => onMarkOneRead(n.id)}
                                        className="flex w-full gap-3 border-b border-base-300/40 px-4 py-3 text-left last:border-b-0 hover:bg-base-200/40"
                                    >
                                        <span
                                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                                n.read ? 'bg-transparent' : 'bg-accent'
                                            }`}
                                            aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-base-content">{n.title}</div>
                                            <div className="text-xs text-base-content/65">{n.message}</div>
                                            <div className="mt-1 text-[11px] text-base-content/45">
                                                {formatRelativeTime(n.created_at)}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={onViewAll}
                className="border-t border-base-300/60 px-4 py-3 text-center text-xs font-semibold text-primary hover:bg-primary/5"
            >
                View all notifications →
            </button>
        </div>
    );
}

function UserMenu({
    me,
    open,
    onOpenChange,
}: {
    me: KeystoneSharedProps['keystone']['me'];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-[var(--chrome-hover-bg)]"
            >
                <Avatar
                    image={me.photo_url ?? undefined}
                    placeholder={me.initials}
                    alt={me.name}
                    color="primary"
                    size="xs"
                />
                <span className="hidden text-xs font-semibold text-[var(--chrome-fg)] sm:inline">
                    {me.name.split(' ')[0]}
                </span>
                <span className="text-[var(--chrome-fg-subtle)]">{Icon.chevronDown}</span>
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-[var(--radius-box)] border border-base-300/60 bg-base-100 shadow-xl">
                    <div className="border-b border-base-300/60 px-4 py-3">
                        <div className="text-sm font-semibold text-base-content">{me.name}</div>
                        <div className="text-xs text-base-content/55">{me.email}</div>
                    </div>
                    <ul className="py-1.5 text-sm">
                        <li>
                            <Link href={admin.profile().url} className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-base-200">
                                Account settings
                            </Link>
                        </li>
                    </ul>
                    <div className="border-t border-base-300/60 py-1.5">
                        <button
                            type="button"
                            onClick={() => router.post('/logout')}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-error hover:bg-error/5"
                        >
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

interface TopbarProps {
    me: KeystoneSharedProps['keystone']['me'];
    notifications: NotificationItem[];
    onSearchClick: () => void;
    onSidebarOpen: () => void;
    onMarkAllNotificationsRead: () => void;
    onMarkOneNotificationRead: (id: number) => void;
}

function Topbar({
    me,
    notifications,
    onSearchClick,
    onSidebarOpen,
    onMarkAllNotificationsRead,
    onMarkOneNotificationRead,
}: TopbarProps) {
    const { resolvedColorScheme, setColorScheme } = useTheme();
    const [bellOpen, setBellOpen] = useState(false);
    const [userOpen, setUserOpen] = useState(false);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-[var(--chrome-border)] bg-[var(--chrome-bg)] px-4 lg:px-6">
            <button
                type="button"
                onClick={onSidebarOpen}
                aria-label="Open menu"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--chrome-input-border)] bg-[var(--chrome-input-bg)] text-[var(--chrome-fg-muted)] hover:bg-[var(--chrome-hover-bg)] lg:hidden"
            >
                {Icon.panelLeft}
            </button>
            <div className="flex flex-1 items-center">
                <SearchTrigger onClick={onSearchClick} />
            </div>
            <div className="flex items-center gap-2">
                <ThemeButton
                    resolvedColorScheme={resolvedColorScheme as 'light' | 'dark'}
                    onToggle={() => setColorScheme(resolvedColorScheme === 'dark' ? 'light' : 'dark')}
                />
                <NotificationsBell
                    unreadCount={unreadCount}
                    open={bellOpen}
                    onOpenChange={setBellOpen}
                    panel={
                        <NotificationsPanel
                            notifications={notifications}
                            onMarkAllRead={onMarkAllNotificationsRead}
                            onMarkOneRead={onMarkOneNotificationRead}
                            onViewAll={() => {
                                setBellOpen(false);
                                router.visit(admin.notifications().url);
                            }}
                        />
                    }
                />
                <UserMenu me={me} open={userOpen} onOpenChange={setUserOpen} />
            </div>
        </header>
    );
}

export default function KeystoneAdminLayout({ children }: { children: ReactNode }) {
    const page = usePage<KeystoneSharedProps & Record<string, unknown>>();
    const { keystone } = page.props;
    const me = keystone.me;
    const isAuthenticated = page.props.auth?.user !== null && page.props.auth?.user !== undefined;

    useThemeSync(keystone.adminTheme.forceTheme);
    useAdminPalette(keystone.adminTheme);

    // Stamps `data-admin` on <body> so the CSS backstop in `app.css` allows
    // the shared NProgress bar to render here (and only here).
    useEffect(() => {
        acquireAdminMarker();
        return () => releaseAdminMarker();
    }, []);

    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>(keystone.notifications);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync of server-pushed notifications to local "mark all read" state
        setNotifications(keystone.notifications);
    }, [keystone.notifications]);

    // Poll for fresh notifications every 30s while the tab is visible so the
    // bell badge picks up new notifications (and dropped unread counts from
    // other devices) without a page refresh. Skipped for guests since the
    // endpoint is sanctum-auth'd and would 401 in a loop.
    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        let cancelled = false;

        async function refresh() {
            if (document.visibilityState !== 'visible') {
                return;
            }
            try {
                const fresh = await fetchNotifications(10);
                if (!cancelled) {
                    setNotifications(fresh);
                }
            } catch (error) {
                console.error('Failed to poll notifications', error);
            }
        }

        const intervalId = window.setInterval(refresh, NOTIFICATIONS_POLL_INTERVAL_MS);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [isAuthenticated]);

    const currentPath = page.url.split('?')[0];
    const navGroups = useMemo(
        () => navGroupsFromAdminMenu(keystone.adminMenu),
        [keystone.adminMenu],
    );

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen((v) => !v);
            }
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const paletteItems: CommandPaletteItem[] = useMemo(
        () =>
            navGroups.flatMap((g) =>
                g.items.flatMap((it) => {
                    const parent: CommandPaletteItem = {
                        label: it.label,
                        kind: 'Page',
                        icon: it.icon,
                        // `external` items aren't Inertia pages — a
                        // full page load, not an Inertia visit.
                        onSelect: () =>
                            it.external
                                ? (window.location.href = it.href)
                                : router.visit(it.href),
                    };
                    const children: CommandPaletteItem[] = (it.children ?? []).map(
                        (child) => ({
                            label: `${it.label} → ${child.label}`,
                            kind: 'Page',
                            icon: it.icon,
                            onSelect: () => router.visit(child.href),
                        }),
                    );
                    return [parent, ...children];
                }),
            ),
        [navGroups],
    );

    const handleMarkAllNotificationsRead = useCallback(async () => {
        // Track the ids we flip optimistically so a failed request only
        // reverts those rows rather than restoring the whole stale list —
        // which would otherwise resurrect notifications other concurrent
        // actions (per-item clicks, the 30s poll) had already persisted.
        let flippedIds: number[] = [];
        setNotifications((prev) => {
            flippedIds = prev.filter((n) => !n.read).map((n) => n.id);
            return prev.map((n) => (n.read ? n : { ...n, read: true }));
        });
        try {
            await markAllNotificationsAsRead();
        } catch (error) {
            console.error('Failed to mark all notifications as read', error);
            const idsToRevert = new Set(flippedIds);
            setNotifications((prev) =>
                prev.map((n) => (idsToRevert.has(n.id) ? { ...n, read: false } : n)),
            );
        }
    }, []);

    const handleMarkOneNotificationRead = useCallback(async (id: number) => {
        let flipped = false;
        setNotifications((prev) => {
            const target = prev.find((n) => n.id === id);
            if (!target || target.read) {
                return prev;
            }
            flipped = true;
            return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        });
        if (!flipped) {
            return;
        }
        try {
            await markNotificationAsRead(id);
        } catch (error) {
            console.error('Failed to mark notification as read', error);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
            );
        }
    }, []);

    return (
        <div className="flex min-h-screen bg-base-200/50 font-sans text-base-content">
            <Sidebar
                collapsed={collapsed}
                onToggleCollapsed={() => setCollapsed((v) => !v)}
                currentPath={currentPath}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
                navGroups={navGroups}
                brand={keystone.brand}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar
                    me={me}
                    notifications={notifications}
                    onSearchClick={() => setPaletteOpen(true)}
                    onSidebarOpen={() => setMobileOpen(true)}
                    onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                    onMarkOneNotificationRead={handleMarkOneNotificationRead}
                />
                <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
            </div>
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={paletteItems} />
        </div>
    );
}
