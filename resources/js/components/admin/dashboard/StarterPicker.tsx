import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Card } from '@/components/admin/keystone';
import { applyStarter } from '@/routes/admin/dashboards';
import type { AvailableWidgets, DashboardStarter } from '@/types/keystone';

interface StarterPickerProps {
    dashboardSlug: string;
    starters: DashboardStarter[];
    availableWidgets: AvailableWidgets;
}

/**
 * Empty-state picker shown whenever a dashboard renders with no widgets.
 *
 * The full starter list is always presented — per-widget permission filtering
 * happens server-side at apply time, so a user without access to a particular
 * widget still sees the starter that includes it and just receives the
 * accessible subset after applying.
 *
 * "Start blank" dismisses the picker locally without an API call; the
 * dashboard stays empty and the user can still add widgets via the Add
 * Widget drawer (separate sub-issue).
 */
export function StarterPicker({ dashboardSlug, starters, availableWidgets }: StarterPickerProps) {
    const [dismissed, setDismissed] = useState(false);
    const [pendingSlug, setPendingSlug] = useState<string | null>(null);

    if (dismissed) {
        return <BlankPlaceholder />;
    }

    function handleApply(slug: string) {
        setPendingSlug(slug);

        router.post(
            applyStarter(dashboardSlug).url,
            { starter: slug },
            {
                preserveScroll: true,
                onFinish: () => setPendingSlug(null),
            },
        );
    }

    return (
        <section
            aria-labelledby="dashboard-starter-heading"
            className="flex flex-col gap-4"
        >
            <header className="flex flex-col gap-1">
                <h2
                    id="dashboard-starter-heading"
                    className="font-display text-base font-semibold text-base-content"
                >
                    Pick a starting point
                </h2>
                <p className="text-sm text-base-content/65">
                    Choose a layout to seed your dashboard with widgets you can rearrange later, or
                    start with a blank canvas.
                </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {starters.map((starter) => (
                    <StarterCard
                        key={starter.slug}
                        starter={starter}
                        availableWidgets={availableWidgets}
                        disabled={pendingSlug !== null}
                        pending={pendingSlug === starter.slug}
                        onSelect={() => handleApply(starter.slug)}
                    />
                ))}

                <Card
                    className="flex flex-col justify-between gap-3 border-dashed"
                    padded
                >
                    <div className="flex flex-col gap-1">
                        <h3 className="font-display text-sm font-semibold text-base-content">
                            Start blank
                        </h3>
                        <p className="text-xs text-base-content/65">
                            Skip the picker and build your dashboard from scratch using the Add
                            Widget drawer.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="self-start rounded-md border border-base-300/60 px-3 py-1.5 text-xs font-medium text-base-content/80 hover:bg-base-200/60 disabled:opacity-50"
                        onClick={() => setDismissed(true)}
                        disabled={pendingSlug !== null}
                    >
                        Start blank
                    </button>
                </Card>
            </div>
        </section>
    );
}

interface StarterCardProps {
    starter: DashboardStarter;
    availableWidgets: AvailableWidgets;
    disabled: boolean;
    pending: boolean;
    onSelect: () => void;
}

function StarterCard({ starter, availableWidgets, disabled, pending, onSelect }: StarterCardProps) {
    return (
        <Card className="flex flex-col gap-3" padded>
            <div className="flex flex-col gap-1">
                <h3 className="font-display text-sm font-semibold text-base-content">
                    {starter.name}
                </h3>
                {starter.description && (
                    <p className="text-xs text-base-content/65">{starter.description}</p>
                )}
            </div>

            <ul className="flex flex-wrap gap-1.5">
                {starter.widgets.map((widget, index) => {
                    const title = availableWidgets[widget.type]?.title ?? widget.type;

                    return (
                        <li
                            key={`${widget.type}-${index}`}
                            className="rounded-full border border-base-300/60 bg-base-200/40 px-2 py-0.5 text-[11px] font-medium text-base-content/75"
                        >
                            {title}
                        </li>
                    );
                })}
            </ul>

            <button
                type="button"
                className="mt-auto self-start rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-50"
                onClick={onSelect}
                disabled={disabled}
            >
                {pending ? 'Applying…' : 'Use this starter'}
            </button>
        </Card>
    );
}

function BlankPlaceholder() {
    return (
        <div className="grid place-items-center rounded-2xl border border-dashed border-base-300/60 bg-base-100 px-6 py-16 text-center">
            <div className="max-w-sm">
                <h2 className="font-display text-base font-semibold text-base-content">
                    Your dashboard is empty
                </h2>
                <p className="mt-2 text-sm text-base-content/65">
                    Add a widget to start tracking the metrics that matter to you.
                </p>
            </div>
        </div>
    );
}
