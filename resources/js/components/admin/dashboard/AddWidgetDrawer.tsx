import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { store as storeWidget } from '@/routes/admin/dashboards/widgets';
import type { AvailableWidget, AvailableWidgets } from '@/types/keystone';

interface AddWidgetDrawerProps {
    open: boolean;
    dashboardSlug: string;
    availableWidgets: AvailableWidgets;
    onClose: () => void;
}

interface CatalogEntry {
    type: string;
    widget: AvailableWidget;
}

/**
 * Right slide-over for adding widgets to the current dashboard.
 *
 * Renders as a fixed-position overlay so it floats above the admin shell's
 * top bar instead of being clipped by the page-content container. Closes on
 * overlay click or Escape. `router.post` uses `preserveState`/`preserveScroll`
 * with `only: ['current', 'available_widgets']` so adding a widget refreshes
 * the dashboard props without resetting the drawer's search or scroll state.
 */
export function AddWidgetDrawer({
    open,
    dashboardSlug,
    availableWidgets,
    onClose,
}: AddWidgetDrawerProps) {
    const [query, setQuery] = useState('');
    const [pendingType, setPendingType] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        // Defer the focus so the panel's open transition doesn't fight the
        // browser's scroll-into-view behavior on the input.
        const focusId = window.setTimeout(() => searchRef.current?.focus(), 0);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            window.clearTimeout(focusId);
        };
    }, [open, onClose]);

    const grouped = useMemo(
        () => groupBySource(filterWidgets(availableWidgets, query)),
        [availableWidgets, query],
    );

    function handleAdd(type: string) {
        setPendingType(type);

        router.post(
            storeWidget(dashboardSlug).url,
            { type },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['current', 'available_widgets'],
                onFinish: () => setPendingType(null),
            },
        );
    }

    const hasResults = grouped.length > 0;

    return (
        <div
            className={`pointer-events-none fixed inset-0 z-50 ${open ? '' : 'invisible'}`}
            aria-hidden={!open}
        >
            <button
                type="button"
                aria-label="Close add widget drawer"
                className={`pointer-events-auto absolute inset-0 bg-black/40 transition-opacity ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
            />

            <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-widget-drawer-heading"
                className={`pointer-events-auto absolute inset-y-0 right-0 flex w-[24rem] max-w-full flex-col border-l border-base-300/60 bg-base-100 shadow-2xl transition-transform duration-200 ${
                    open ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <header className="flex items-start justify-between gap-4 border-b border-base-300/60 px-5 py-4">
                    <div className="flex flex-col gap-1">
                        <h2
                            id="add-widget-drawer-heading"
                            className="font-display text-base font-semibold text-base-content"
                        >
                            Add a widget
                        </h2>
                        <p className="text-xs text-base-content/65">
                            Browse the widgets you have access to and add them to this dashboard.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close add widget drawer"
                        className="rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-base-content"
                        onClick={onClose}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden
                            className="h-4 w-4"
                        >
                            <path
                                d="M6 6l12 12M18 6 6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </header>

                <div className="px-5 pt-4 pb-2">
                    <label className="sr-only" htmlFor="add-widget-search">
                        Search widgets
                    </label>
                    <input
                        id="add-widget-search"
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search widgets…"
                        className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/45 focus:border-primary focus:outline-none"
                    />
                </div>

                <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5">
                    {hasResults ? (
                        <ul className="flex flex-col gap-5">
                            {grouped.map(({ source, entries }) => (
                                <li key={source} className="flex flex-col gap-2">
                                    <h3 className="text-[11px] font-semibold tracking-wider text-base-content/55 uppercase">
                                        {formatSource(source)}
                                    </h3>
                                    <ul className="flex flex-col gap-2">
                                        {entries.map(({ type, widget }) => (
                                            <li
                                                key={type}
                                                className="flex flex-col gap-2 rounded-lg border border-base-300/60 bg-base-100 p-3"
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-sm font-semibold text-base-content">
                                                        {widget.title}
                                                    </p>
                                                    {widget.description && (
                                                        <p className="text-xs text-base-content/65">
                                                            {widget.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="self-start rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-50"
                                                    onClick={() => handleAdd(type)}
                                                    disabled={pendingType !== null}
                                                >
                                                    {pendingType === type ? 'Adding…' : 'Add'}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="px-1 py-8 text-center text-sm text-base-content/55">
                            {query.trim() === ''
                                ? 'No widgets are available to add.'
                                : 'No widgets match that search.'}
                        </p>
                    )}
                </div>
            </aside>
        </div>
    );
}

function filterWidgets(catalog: AvailableWidgets, query: string): CatalogEntry[] {
    const needle = query.trim().toLowerCase();
    const entries: CatalogEntry[] = Object.entries(catalog).map(([type, widget]) => ({
        type,
        widget,
    }));

    if (needle === '') {
        return entries;
    }

    return entries.filter(({ widget }) => {
        const haystack = `${widget.title} ${widget.description ?? ''}`.toLowerCase();
        return haystack.includes(needle);
    });
}

interface GroupedEntries {
    source: string;
    entries: CatalogEntry[];
}

function groupBySource(entries: CatalogEntry[]): GroupedEntries[] {
    const groups = new Map<string, CatalogEntry[]>();

    for (const entry of entries) {
        const source = entry.widget.source || 'keystone';
        const bucket = groups.get(source) ?? [];
        bucket.push(entry);
        groups.set(source, bucket);
    }

    // Keystone-native widgets first, then plugin sources alphabetically, so
    // the grouping is stable and predictable across renders.
    return Array.from(groups.entries())
        .sort(([a], [b]) => {
            if (a === b) {
                return 0;
            }
            if (a === 'keystone') {
                return -1;
            }
            if (b === 'keystone') {
                return 1;
            }
            return a.localeCompare(b);
        })
        .map(([source, sourceEntries]) => ({
            source,
            entries: sourceEntries.sort((left, right) =>
                left.widget.title.localeCompare(right.widget.title),
            ),
        }));
}

function formatSource(source: string): string {
    if (source === 'keystone') {
        return 'Keystone';
    }
    return source
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
