import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import type { ContentEditEntry } from './types';

/**
 * Renders a real tab strip with selection state for the `tabs` slot,
 * rather than mounting every tab body as a sibling. The tab bar sits
 * above the panel bodies and matches the WAI-ARIA tabs pattern —
 * roving `tabIndex` (only the active tab is in the tab sequence) plus
 * ArrowLeft / ArrowRight / Home / End keyboard navigation — so
 * screen-reader and keyboard-only users can move between tabs the same
 * way native tabs work.
 *
 * The caller (`AdminEditSlot`) hands over the ORDERED tab entries and
 * a `render` function that knows how to resolve the entry's component
 * — this keeps the tab strip agnostic to whether the tab body comes
 * from the built-in registry or a federated remote.
 */
export function AdminEditTabs({
    entries,
    render,
}: {
    entries: ContentEditEntry[];
    render: (entry: ContentEditEntry) => ReactNode;
}) {
    // `keystone.admin.tabs.active` filter — resolves the initially-active
    // tab slug so a plugin can restore per-user tab memory (a hint from
    // localStorage, a query-param deep link, a per-role default). Runs once
    // per mount; runtime tab clicks flow through `setActiveSlug` and are
    // NOT re-filtered so a plugin can't fight the user's click. Args:
    // `(slug, { entries })`. Return a slug not present in `entries` and
    // the fallback lookup below drops it back to index 0.
    const [activeSlug, setActiveSlug] = useState<string>(() => {
        const fallback = entries[0]?.slug ?? '';
        return applyFilters<string>('keystone.admin.tabs.active', fallback, { entries });
    });
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    if (entries.length === 0) {
        return null;
    }

    const activeIndex = Math.max(
        0,
        entries.findIndex((e) => e.slug === activeSlug),
    );
    const active = entries[activeIndex];

    function focusTab(index: number): void {
        const clamped = ((index % entries.length) + entries.length) % entries.length;
        const target  = entries[clamped];
        setActiveSlug(target.slug);
        // Focus happens after the next commit; the ref lookup runs
        // inside a microtask so the newly-activated button is already
        // in the DOM with `tabIndex=0`.
        queueMicrotask(() => tabRefs.current[target.slug]?.focus());
    }

    function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                focusTab(index - 1);
                break;
            case 'ArrowRight':
                event.preventDefault();
                focusTab(index + 1);
                break;
            case 'Home':
                event.preventDefault();
                focusTab(0);
                break;
            case 'End':
                event.preventDefault();
                focusTab(entries.length - 1);
                break;
        }
    }

    return (
        <div className="rounded-lg border border-base-300/60 bg-base-100">
            <div
                role="tablist"
                aria-label="Edit tabs"
                className="flex flex-wrap gap-1 border-b border-base-300/60 px-2 pt-2"
            >
                {entries.map((entry, index) => {
                    const isActive = entry.slug === active.slug;
                    return (
                        <button
                            key={entry.slug}
                            type="button"
                            role="tab"
                            id={`admin-edit-tab-${entry.slug}`}
                            aria-selected={isActive}
                            aria-controls={`admin-edit-tabpanel-${entry.slug}`}
                            tabIndex={isActive ? 0 : -1}
                            ref={(el) => {
                                tabRefs.current[entry.slug] = el;
                            }}
                            onClick={() => setActiveSlug(entry.slug)}
                            onKeyDown={(e) => onTabKeyDown(e, index)}
                            className={
                                'rounded-t-md border-b-2 px-3 py-2 text-xs font-semibold transition-colors ' +
                                (isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-base-content/65 hover:text-base-content')
                            }
                        >
                            {entry.title ?? entry.slug}
                        </button>
                    );
                })}
            </div>
            <div
                role="tabpanel"
                id={`admin-edit-tabpanel-${active.slug}`}
                aria-labelledby={`admin-edit-tab-${active.slug}`}
                className="p-4"
            >
                {render(active)}
            </div>
        </div>
    );
}
