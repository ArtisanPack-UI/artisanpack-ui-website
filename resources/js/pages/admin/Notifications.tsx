import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Head, Link } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    EmptyState,
    Icon,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';
import { preferences as notificationPreferencesRoute } from '@/routes/admin/notifications';
import { formatDateTime, formatRelativeTime } from '@/lib/admin/shared';
import {
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '@/lib/admin/notificationsApi';
import type { NotificationItem } from '@/types/keystone';

const kindLabel: Record<string, string> = {
    order: 'Order',
    inventory: 'Inventory',
    lead: 'Lead',
    system: 'System',
    content: 'Content',
    reports: 'Report',
    error: 'Error',
    warning: 'Warning',
    success: 'Success',
    info: 'Info',
};

const kindTone: Record<string, Tone> = {
    order: 'success',
    inventory: 'warning',
    lead: 'accent',
    system: 'info',
    content: 'primary',
    reports: 'neutral',
    error: 'error',
    warning: 'warning',
    success: 'success',
    info: 'info',
};

type FilterKey = 'all' | 'unread' | string;

const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'order', label: 'Orders' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'lead', label: 'Leads' },
    { key: 'system', label: 'System' },
    { key: 'content', label: 'Content' },
    { key: 'reports', label: 'Reports' },
    { key: 'error', label: 'Errors' },
    { key: 'warning', label: 'Warnings' },
    { key: 'success', label: 'Success' },
    { key: 'info', label: 'Info' },
];

interface NotificationsPageProps {
    notifications: NotificationItem[];
}

export default function Notifications({ notifications: initialNotifications }: NotificationsPageProps) {
    const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
    const [filter, setFilter] = useState<FilterKey>('all');

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync to fresh server-pushed notifications after Inertia re-renders the page
        setNotifications(initialNotifications);
    }, [initialNotifications]);

    const filtered = useMemo(() => {
        if (filter === 'all') return notifications;
        if (filter === 'unread') return notifications.filter((n) => !n.read);
        return notifications.filter((n) => n.kind === filter);
    }, [notifications, filter]);

    const grouped = useMemo(() => {
        const now = new Date();
        const today = now.toDateString();
        const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
        const out: Record<string, NotificationItem[]> = {};
        for (const n of filtered) {
            const d = new Date(n.created_at).toDateString();
            const label =
                d === today
                    ? 'Today'
                    : d === yesterday
                      ? 'Yesterday'
                      : new Date(n.created_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                        });
            (out[label] ||= []).push(n);
        }
        return out;
    }, [filtered]);

    const unreadCount = notifications.filter((n) => !n.read).length;

    async function handleMarkAllRead() {
        // Track the ids we flip so a failed request only reverts those rows
        // rather than restoring the whole stale list — which would otherwise
        // resurrect notifications other actions (per-item clicks elsewhere,
        // the 30s poll) had already persisted.
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
    }

    async function handleMarkOneRead(id: number) {
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
    }

    return (
        <>
            <Head title="Notifications" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Notifications"
                    description={`${unreadCount} unread · ${notifications.length} total`}
                    actions={
                        <>
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                disabled={unreadCount === 0}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 disabled:opacity-50"
                            >
                                {Icon.check}
                                Mark all read
                            </button>
                            <Link
                                href={notificationPreferencesRoute.url()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                            >
                                {Icon.settings}
                                Preferences
                            </Link>
                        </>
                    }
                />

                <div className="flex flex-wrap items-center gap-1.5">
                    {filters.map((f) => {
                        const active = filter === f.key;
                        const count =
                            f.key === 'all'
                                ? notifications.length
                                : f.key === 'unread'
                                  ? unreadCount
                                  : notifications.filter((n) => n.kind === f.key).length;
                        return (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setFilter(f.key)}
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    active
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-base-300/60 bg-base-100 text-base-content/65 hover:bg-base-200'
                                }`}
                            >
                                <span>{f.label}</span>
                                <span
                                    className={`rounded-full px-1.5 text-[10px] ${
                                        active ? 'bg-primary/15 text-primary' : 'bg-base-200 text-base-content/60'
                                    }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <Card padded={false}>
                    {Object.keys(grouped).length === 0 ? (
                        <EmptyState
                            title="No notifications match this filter"
                            description="Try a different category or clear the filter to see everything."
                        />
                    ) : (
                        Object.entries(grouped).map(([day, items]) => (
                            <div key={day}>
                                <div className="border-b border-base-300/60 bg-base-200/40 px-5 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                    {day}
                                </div>
                                <ul>
                                    {items.map((n) => (
                                        <li key={n.id} className="flex items-stretch border-b border-base-300/40 last:border-b-0 hover:bg-base-200/40">
                                            <button
                                                type="button"
                                                onClick={() => handleMarkOneRead(n.id)}
                                                className="flex flex-1 items-start gap-4 px-5 py-4 text-left"
                                            >
                                                <span
                                                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                                        n.read ? 'bg-transparent ring-1 ring-base-300' : 'bg-accent'
                                                    }`}
                                                    aria-hidden
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="text-sm font-semibold text-base-content">{n.title}</h3>
                                                        <StatusBadge label={kindLabel[n.kind] ?? n.kind} tone={kindTone[n.kind] ?? 'neutral'} />
                                                    </div>
                                                    <p className="mt-0.5 text-sm text-base-content/70">{n.message}</p>
                                                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-base-content/45">
                                                        <span>{formatRelativeTime(n.created_at)}</span>
                                                        <span>·</span>
                                                        <span>{formatDateTime(n.created_at)}</span>
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Notification actions"
                                                className="mr-5 mt-4 grid h-7 w-7 shrink-0 place-items-center self-start rounded-md text-base-content/45 hover:bg-base-200 hover:text-base-content"
                                            >
                                                {Icon.kebab}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </Card>
            </div>
        </>
    );
}

Notifications.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
