import type { WidgetComponentProps } from '@/lib/admin/widget-registry';
import type { FunnelStep } from '@/types/keystone';

interface LeadFunnelData {
    funnel: FunnelStep[];
}

export function LeadFunnelWidget({ data }: WidgetComponentProps<LeadFunnelData>) {
    const { funnel } = data;
    const max = Math.max(...funnel.map((f) => f.value), 1);

    return (
        <ul className="flex flex-col gap-2">
            {funnel.map((step, idx) => {
                const width = (step.value / max) * 100;
                const next = funnel[idx + 1];
                const conversion =
                    next && step.value > 0 ? ((next.value / step.value) * 100).toFixed(1) : null;

                return (
                    <li key={`${step.label}-${idx}`}>
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-base-content">{step.label}</span>
                            <span className="text-base-content/60">{step.value.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-base-200">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                                style={{ width: `${width}%` }}
                            />
                        </div>
                        {conversion && next && (
                            <div className="mt-1 text-[11px] text-base-content/45">
                                {conversion}% → {next.label}
                            </div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
