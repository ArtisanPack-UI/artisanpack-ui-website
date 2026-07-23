import { type ReactNode } from 'react';
import { Icon } from '@/components/admin/keystone';
import { formatNumber } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';

interface SiteAtAGlanceData {
    counts: {
        pages: number | null;
        posts: number | null;
        media: number | null;
    };
}

interface CountRow {
    key: keyof SiteAtAGlanceData['counts'];
    label: string;
    icon: ReactNode;
}

const ROWS: CountRow[] = [
    { key: 'pages', label: 'Pages', icon: Icon.pages },
    { key: 'posts', label: 'Posts', icon: Icon.posts },
    { key: 'media', label: 'Media items', icon: Icon.media },
];

export function SiteAtAGlanceWidget({ data }: WidgetComponentProps<SiteAtAGlanceData>) {
    const visible = ROWS.filter((row) => data.counts[row.key] !== null);

    if (visible.length === 0) {
        return (
            <div className="grid h-32 place-items-center text-sm text-base-content/55">
                Nothing to show — enable a count in widget settings.
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-2.5">
            {visible.map((row) => (
                <li
                    key={row.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-base-300/40 px-3 py-2.5"
                >
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/8 text-primary">
                            {row.icon}
                        </span>
                        <span className="text-sm font-semibold text-base-content">{row.label}</span>
                    </div>
                    <span className="font-display text-lg font-bold tracking-tight text-base-content">
                        {formatNumber(data.counts[row.key] ?? 0)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
