import { useEffect, useRef, useState } from 'react';
import { Link } from '@inertiajs/react';
import { show as showDashboard } from '@/routes/admin/dashboards';
import { manage as manageDashboards } from '@/routes/admin/dashboards';
import type { DashboardSummary } from '@/types/keystone';

interface DashboardSwitcherProps {
    dashboards: DashboardSummary[];
    currentSlug: string;
    onCreateClick: () => void;
}

/**
 * Page-header dropdown that lists every dashboard the user owns. The star
 * marks the user's default dashboard so a glance is enough to tell which
 * one `/admin` would redirect to. Footer items open the create modal and
 * link to the Manage dashboards page.
 *
 * Closes on outside click, on Escape, and after any navigation — Inertia
 * link clicks unmount the dropdown anyway, but clearing `open` first
 * prevents a brief flash of the open state during the page transition.
 */
export function DashboardSwitcher({ dashboards, currentSlug, onCreateClick }: DashboardSwitcherProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleClick(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    const current = dashboards.find((dashboard) => dashboard.slug === currentSlug);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-md border border-base-300/60 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content hover:bg-base-200/60"
            >
                <span className="max-w-[14rem] truncate">{current?.name ?? 'Dashboards'}</span>
                <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3.5 w-3.5">
                    <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            {/*
                The popover is deliberately not `role="menu"`/`role="menuitem"`.
                That ARIA pattern promises arrow-key navigation with roving
                focus, and this is a Tab/Escape popover of ordinary links and
                buttons — announcing a menu that ignores arrow keys is worse
                than announcing nothing. The list keeps its own accessible name.
            */}
            {open && (
                <div className="absolute right-0 z-40 mt-2 flex w-72 flex-col rounded-lg border border-base-300/60 bg-base-100 py-1 shadow-xl">
                    <ul aria-label="Switch dashboard" className="max-h-72 overflow-y-auto py-1">
                        {dashboards.map((dashboard) => {
                            const isCurrent = dashboard.slug === currentSlug;
                            return (
                                <li key={dashboard.id}>
                                    <Link
                                        href={showDashboard(dashboard.slug).url}
                                        className={`flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-base-200/60 ${
                                            isCurrent ? 'bg-base-200/40 font-semibold text-base-content' : 'text-base-content/85'
                                        }`}
                                        onClick={() => setOpen(false)}
                                    >
                                        <span className="truncate">{dashboard.name}</span>
                                        {dashboard.is_default && (
                                            <span
                                                aria-label="Default dashboard"
                                                title="Default dashboard"
                                                className="shrink-0 text-warning"
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
                                                    <path d="M12 2.5l2.92 5.92 6.58.95-4.75 4.62 1.12 6.51L12 17.77l-5.87 3.08 1.12-6.5L2.5 9.71l6.58-.96L12 2.5z" />
                                                </svg>
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="flex flex-col border-t border-base-300/60 py-1">
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                onCreateClick();
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-left text-sm text-base-content/85 hover:bg-base-200/60"
                        >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                                <path
                                    d="M12 5v14M5 12h14"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                            New dashboard
                        </button>
                        <Link
                            href={manageDashboards().url}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-base-content/85 hover:bg-base-200/60"
                        >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                                <path
                                    d="M4 6h16M4 12h16M4 18h16"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                            Manage dashboards
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
