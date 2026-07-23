import type { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import { Avatar } from '@artisanpack-ui/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, Icon, PageHeader } from '@/components/admin/keystone';
import { formatDateTime, formatRelativeTime, initialsOf } from '@/lib/admin/shared';
import type { ActivityEvent } from '@/types/keystone';

export default function ActivityLog({ activity_log }: { activity_log: ActivityEvent[] }) {
    return (
        <>
            <Head title="Activity Log" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Activity Log"
                    description="Audit trail of admin actions across the site."
                    actions={
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200">
                            Export
                        </button>
                    }
                />

                <Card padded={false}>
                    <ul>
                        {activity_log.map((event) => (
                            <li key={event.id} className="flex items-start gap-4 border-b border-base-300/40 px-5 py-4 last:border-b-0 hover:bg-base-200/40">
                                <Avatar
                                    placeholder={initialsOf(event.actor)}
                                    color={event.actor === 'System' ? 'neutral' : 'primary'}
                                    size="sm"
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm">
                                        <span className="font-semibold text-base-content">{event.actor}</span>{' '}
                                        <span className="text-base-content/70">{event.action}</span>{' '}
                                        <span className="font-semibold text-base-content">{event.target}</span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-3 text-[11px] text-base-content/45">
                                        <span>{formatRelativeTime(event.at)}</span>
                                        <span>·</span>
                                        <span>{formatDateTime(event.at)}</span>
                                    </div>
                                </div>
                                <button type="button" aria-label="More options" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-base-content/55 hover:bg-base-200 hover:text-base-content">
                                    {Icon.kebab}
                                </button>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </>
    );
}

ActivityLog.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
