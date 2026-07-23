import { StatusBadge, type Tone } from '@/components/admin/keystone';
import { formatRelativeTime } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { LeadRow } from '@/types/keystone';

interface RecentLeadsData {
    leads: LeadRow[];
}

const LEAD_STATUS_TONE: Record<string, Tone> = {
    new: 'accent',
    contacted: 'info',
    qualified: 'success',
};

export function RecentLeadsWidget({ data }: WidgetComponentProps<RecentLeadsData>) {
    if (data.leads.length === 0) {
        return (
            <div className="grid h-32 place-items-center text-sm text-base-content/55">
                No leads yet.
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-3">
            {data.leads.map((lead) => (
                <li
                    key={lead.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-base-300/40 bg-base-200/40 px-3 py-2.5"
                >
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-base-content">{lead.name}</span>
                            <StatusBadge
                                label={lead.status}
                                tone={LEAD_STATUS_TONE[lead.status] ?? 'neutral'}
                            />
                        </div>
                        <div className="text-xs text-base-content/65">
                            {lead.company} · {lead.form}
                        </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-base-content/45">
                        {formatRelativeTime(lead.received_at)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
