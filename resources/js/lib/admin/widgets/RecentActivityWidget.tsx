import { Icon, StatusBadge, type Tone } from '@/components/admin/keystone';
import { formatRelativeTime } from '@/lib/admin/shared';
import type { WidgetComponentProps } from '@/lib/admin/widget-registry';

type ActivityType = 'page' | 'post';

interface ActivityItem {
    type: ActivityType;
    id: number;
    title: string;
    updated_at: string;
    edit_url: string;
}

interface RecentActivityData {
    items: ActivityItem[];
}

const TYPE_TONE: Record<ActivityType, Tone> = {
    page: 'info',
    post: 'accent',
};

const TYPE_LABEL: Record<ActivityType, string> = {
    page: 'Page',
    post: 'Post',
};

const TYPE_ICON: Record<ActivityType, typeof Icon.pages> = {
    page: Icon.pages,
    post: Icon.posts,
};

export function RecentActivityWidget({ data }: WidgetComponentProps<RecentActivityData>) {
    if (data.items.length === 0) {
        return (
            <div className="grid h-32 place-items-center text-sm text-base-content/55">
                No recent edits yet.
            </div>
        );
    }

    return (
        <ul className="flex flex-col gap-2.5">
            {data.items.map((item) => (
                <li
                    key={`${item.type}-${item.id}`}
                    className="flex items-start justify-between gap-3 rounded-lg border border-base-300/40 px-3 py-2.5"
                >
                    <div className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-base-200/60 text-base-content/65">
                            {TYPE_ICON[item.type]}
                        </span>
                        <div className="min-w-0">
                            <a
                                href={item.edit_url}
                                className="block truncate text-sm font-semibold text-base-content hover:text-primary"
                            >
                                {item.title}
                            </a>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-base-content/55">
                                <StatusBadge label={TYPE_LABEL[item.type]} tone={TYPE_TONE[item.type]} />
                                <span>{formatRelativeTime(item.updated_at)}</span>
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}
