import type { ReactNode } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { Card, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { DangerButton, PrimaryButton } from '@/components/admin/keystone-form';
import { destroy as destroyTwoFactor, store as storeTwoFactor } from '@/routes/admin/two-factor';

interface PageProps {
    enabled: boolean;
    enabled_at: string | null;
    flash: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function TwoFactor() {
    const { enabled, enabled_at, flash } = usePage<PageProps>().props;

    function enable() {
        router.post(storeTwoFactor().url, {}, { preserveScroll: true });
    }

    function disable() {
        if (!confirm('Disable two-factor authentication?')) return;
        router.delete(destroyTwoFactor().url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Two-factor authentication" />

            <PageHeader
                title="Two-factor authentication"
                description="Add an extra layer of security to your account."
            />

            {flash.success && (
                <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                    {flash.success}
                </div>
            )}
            {flash.error && (
                <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
                    {flash.error}
                </div>
            )}

            <Card>
                <div className="flex items-center gap-3">
                    <StatusBadge
                        label={enabled ? 'Enabled' : 'Disabled'}
                        tone={enabled ? 'success' : 'neutral'}
                    />
                    {enabled && enabled_at && (
                        <span className="text-xs text-base-content/55">
                            Since {new Date(enabled_at).toLocaleDateString()}
                        </span>
                    )}
                </div>

                <div className="mt-4 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">
                    When enabled, you&apos;ll be emailed a one-time code to enter after your password
                    on each login.
                </div>

                <div className="mt-5 flex items-center justify-end border-t border-base-300/60 pt-4">
                    {enabled ? (
                        <DangerButton type="button" onClick={disable}>
                            Disable two-factor authentication
                        </DangerButton>
                    ) : (
                        <PrimaryButton type="button" onClick={enable}>
                            Enable two-factor authentication
                        </PrimaryButton>
                    )}
                </div>
            </Card>
        </>
    );
}

TwoFactor.layout = (page: ReactNode) => <SettingsLayout>{page}</SettingsLayout>;
