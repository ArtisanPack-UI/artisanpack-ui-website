import type { WidgetComponentProps } from '@/lib/admin/widget-registry';

interface WelcomeAction {
    key: string;
    label: string;
    url: string;
}

interface WelcomeData {
    site_name: string;
    display_name: string;
    actions: WelcomeAction[];
}

export function WelcomeWidget({ data }: WidgetComponentProps<WelcomeData>) {
    const greeting = data.display_name
        ? `Welcome back, ${data.display_name}.`
        : 'Welcome back.';

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-base-content/55">
                    {data.site_name}
                </div>
                <div className="mt-1 font-display text-[22px] font-bold tracking-tight text-base-content">
                    {greeting}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {data.actions.map((action) => (
                    <a
                        key={action.key}
                        href={action.url}
                        className="inline-flex items-center rounded-md border border-base-300/60 bg-base-100 px-3 py-1.5 text-sm font-semibold text-base-content transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    >
                        {action.label}
                    </a>
                ))}
            </div>
        </div>
    );
}
