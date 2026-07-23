import type { WidgetComponentProps } from '@/lib/admin/widget-registry';

interface UpdateBannerData {
    visible: boolean;
    current_version?: string;
    latest_version?: string;
    release_date?: string | null;
    changelog?: string | null;
}

/**
 * Render the body of the update banner. The "self-collapsing" behavior
 * lives in `DashboardGrid` — it skips the entire chrome when
 * `data.visible === false` so the banner never paints a frame for that
 * load. This component is therefore safe to assume the visible branch.
 */
export function UpdateBannerWidget({ data }: WidgetComponentProps<UpdateBannerData>) {
    if (!data.visible) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-info">
                    Keystone update available
                </div>
                <div className="mt-1 text-sm text-base-content">
                    Version{' '}
                    <span className="font-mono font-semibold">{data.latest_version ?? 'unknown'}</span> is
                    available — you&apos;re on{' '}
                    <span className="font-mono font-semibold">{data.current_version ?? 'unknown'}</span>.
                </div>
            </div>
        </div>
    );
}
