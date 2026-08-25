import { useMemo, useState, type ReactNode } from 'react';
import { Head, Link } from '@inertiajs/react';
import { ToastProvider, useToast } from '@artisanpack-ui/react/feedback';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, EmptyState, Icon, PageHeader } from '@/components/admin/keystone';
import { notifications as notificationsRoute } from '@/routes/admin';
import {
    fetchNotificationPreferences,
    NotificationPreferencesApiError,
    resetNotificationPreferences,
    saveNotificationPreferences,
    type NotificationPreferencesPayload,
    type NotificationPreferenceType,
} from '@/lib/admin/notificationPreferencesApi';

interface NotificationPreferencesPageProps {
    preferences: NotificationPreferencesPayload;
}

function PreferenceToggle({
    id,
    checked,
    onChange,
    label,
}: {
    id: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
}) {
    return (
        <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-base-content/75">
            <span className="relative inline-block h-5 w-9">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="peer sr-only"
                />
                <span className="block h-5 w-9 rounded-full bg-base-content/25 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40" />
                <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
            <span>{label}</span>
        </label>
    );
}

function NotificationPreferencesContent({ preferences }: NotificationPreferencesPageProps) {
    const toast = useToast();
    const [types, setTypes] = useState<NotificationPreferenceType[]>(preferences.types);
    const [baseline, setBaseline] = useState<NotificationPreferenceType[]>(preferences.types);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);

    const dirty = useMemo(() => {
        if (types.length !== baseline.length) return true;
        return types.some((current, index) => {
            const original = baseline[index];
            return (
                current.key !== original.key
                || current.is_enabled !== original.is_enabled
                || current.email_enabled !== original.email_enabled
            );
        });
    }, [types, baseline]);

    function updateType(key: string, patch: Partial<NotificationPreferenceType>) {
        setTypes((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
    }

    function applyPayload(payload: NotificationPreferencesPayload) {
        setTypes(payload.types);
        setBaseline(payload.types);
    }

    async function handleSave() {
        if (!dirty || saving || resetting) return;
        setSaving(true);
        try {
            const payload = await saveNotificationPreferences(
                types.map((t) => ({
                    notification_type: t.key,
                    is_enabled: t.is_enabled,
                    email_enabled: t.email_enabled,
                })),
            );
            applyPayload(payload);
            toast.success('Notification preferences saved.');
        } catch (error) {
            const message = error instanceof NotificationPreferencesApiError
                ? error.message
                : 'Could not save preferences.';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    }

    async function handleCancel() {
        if (!dirty || saving || resetting) return;
        try {
            const payload = await fetchNotificationPreferences();
            applyPayload(payload);
        } catch {
            setTypes(baseline);
        }
    }

    async function handleReset() {
        if (resetting) return;
        const confirmed = window.confirm(
            'Reset all notification preferences? Every notification type will return to the default "enabled" setting.',
        );
        if (!confirmed) return;
        setResetting(true);
        try {
            const payload = await resetNotificationPreferences();
            applyPayload(payload);
            toast.success('Notification preferences reset to defaults.');
        } catch (error) {
            const message = error instanceof NotificationPreferencesApiError
                ? error.message
                : 'Could not reset preferences.';
            toast.error(message);
        } finally {
            setResetting(false);
        }
    }

    return (
        <>
            <Head title="Notification preferences" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Notification preferences"
                    description="Choose which notifications you receive in the admin shell and by email."
                    breadcrumbs={['Notifications', 'Preferences']}
                    actions={
                        <>
                            <Link
                                href={notificationsRoute.url()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                            >
                                {Icon.bell}
                                Back to notifications
                            </Link>
                            <button
                                type="button"
                                onClick={handleReset}
                                disabled={resetting || saving}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {resetting ? 'Resetting…' : 'Reset to defaults'}
                            </button>
                        </>
                    }
                />

                <Card padded={false}>
                    {types.length === 0 ? (
                        <EmptyState
                            title="No notification types registered"
                            description="Once features start dispatching notifications, you'll be able to opt in and out of each one here."
                        />
                    ) : (
                        <>
                            <div className="hidden border-b border-base-300/60 bg-base-200/40 px-5 py-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55 md:grid md:grid-cols-[1fr_auto_auto] md:gap-6">
                                <span>Notification</span>
                                <span className="text-right">In-app</span>
                                <span className="text-right">Email</span>
                            </div>
                            <ul>
                                {types.map((type) => (
                                    <li
                                        key={type.key}
                                        className="grid grid-cols-1 gap-3 border-b border-base-300/40 px-5 py-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center md:gap-6"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm font-semibold text-base-content">
                                                    {type.title}
                                                </h3>
                                                <code className="rounded bg-base-200 px-1.5 py-0.5 text-[11px] font-normal text-base-content/55">
                                                    {type.key}
                                                </code>
                                            </div>
                                            {type.content && (
                                                <p className="mt-1 text-sm text-base-content/70">
                                                    {type.content}
                                                </p>
                                            )}
                                        </div>
                                        <div className="md:justify-self-end">
                                            <PreferenceToggle
                                                id={`pref-${type.key}-in-app`}
                                                checked={type.is_enabled}
                                                onChange={(value) => updateType(type.key, { is_enabled: value })}
                                                label="In-app"
                                            />
                                        </div>
                                        <div className="md:justify-self-end">
                                            <PreferenceToggle
                                                id={`pref-${type.key}-email`}
                                                checked={type.email_enabled}
                                                onChange={(value) => updateType(type.key, { email_enabled: value })}
                                                label="Email"
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex items-center justify-end gap-2 border-t border-base-300/60 px-5 py-4">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    disabled={!dirty || saving || resetting}
                                    className="rounded-lg border border-base-300/60 bg-base-100 px-4 py-2 text-sm font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!dirty || saving || resetting}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {saving && (
                                        <span
                                            aria-hidden
                                            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-content/60 border-t-transparent"
                                        />
                                    )}
                                    {saving ? 'Saving…' : 'Save changes'}
                                </button>
                            </div>
                        </>
                    )}
                </Card>
            </div>
        </>
    );
}

export default function NotificationPreferences(props: NotificationPreferencesPageProps) {
    return (
        <ToastProvider>
            <NotificationPreferencesContent {...props} />
        </ToastProvider>
    );
}

NotificationPreferences.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
