import type { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    Icon,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';
import { formatRelativeTime } from '@/lib/admin/shared';
import type { IntegrationRow } from '@/types/keystone';

const statusTone: Record<IntegrationRow['status'], Tone> = {
    connected: 'success',
    available: 'neutral',
    error: 'error',
};

const statusLabel: Record<IntegrationRow['status'], string> = {
    connected: 'Connected',
    available: 'Available',
    error: 'Needs attention',
};

function initialOf(name: string): string {
    return name[0] ?? '';
}

export default function Integrations({ integrations }: { integrations: IntegrationRow[] }) {
    const connected = integrations.filter((i) => i.status === 'connected');
    const errored = integrations.filter((i) => i.status === 'error');
    const available = integrations.filter((i) => i.status === 'available');

    return (
        <>
            <Head title="Integrations" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Integrations"
                    description="Connect external services and APIs to your Keystone site."
                    actions={
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/75 hover:bg-base-200">
                            Browse marketplace
                        </button>
                    }
                />

                {errored.length > 0 && (
                    <Card className="border-error/30 bg-error/5">
                        <div className="flex items-start gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-error/15 text-error">
                                {Icon.activity}
                            </span>
                            <div className="flex-1">
                                <div className="font-display text-sm font-semibold text-base-content">
                                    {errored.length} integration{errored.length > 1 ? 's' : ''} need{errored.length > 1 ? '' : 's'} attention
                                </div>
                                <div className="text-xs text-base-content/65">
                                    {errored.map((i) => i.name).join(', ')} — re-authenticate to keep them working.
                                </div>
                            </div>
                            <button type="button" className="rounded-lg border border-error/40 bg-base-100 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10">
                                Resolve
                            </button>
                        </div>
                    </Card>
                )}

                <div>
                    <h2 className="mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                        Connected ({connected.length})
                    </h2>
                    <div className="grid grid-cols-12 gap-7">
                        {[...connected, ...errored].map((i) => (
                            <div key={i.id} className="col-span-12 sm:col-span-6 xl:col-span-4">
                                <Card>
                                    <div className="flex items-start gap-3">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 font-display text-base font-bold text-primary">
                                            {initialOf(i.name)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="font-display text-sm font-semibold text-base-content">{i.name}</div>
                                                <StatusBadge label={statusLabel[i.status]} tone={statusTone[i.status]} />
                                            </div>
                                            <div className="text-[11px] text-base-content/55">{i.category}</div>
                                            {i.connected_at && (
                                                <div className="mt-2 text-[11px] text-base-content/45">
                                                    Connected {formatRelativeTime(i.connected_at)} by {i.connected_by}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-base-300/60 pt-3">
                                        <button type="button" className="text-xs font-semibold text-base-content/65 hover:text-base-content">
                                            Configure
                                        </button>
                                        <button type="button" className="text-xs font-semibold text-error hover:underline">
                                            Disconnect
                                        </button>
                                    </div>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">Available</h2>
                    <div className="grid grid-cols-12 gap-7">
                        {available.map((i) => (
                            <div key={i.id} className="col-span-12 sm:col-span-6 xl:col-span-4">
                                <Card>
                                    <div className="flex items-start gap-3">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-base-200 font-display text-base font-bold text-base-content/65">
                                            {initialOf(i.name)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-display text-sm font-semibold text-base-content">{i.name}</div>
                                            <div className="text-[11px] text-base-content/55">{i.category}</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-end border-t border-base-300/60 pt-3">
                                        <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90">
                                            Connect
                                        </button>
                                    </div>
                                </Card>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

Integrations.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
