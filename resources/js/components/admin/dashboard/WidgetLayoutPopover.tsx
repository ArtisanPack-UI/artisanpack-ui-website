import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { layout as layoutRoute } from '@/routes/admin/dashboards/widgets';
import { useFocusTrap } from '@/lib/admin/useFocusTrap';
import type { AvailableWidget, Widget, WidgetGridConfig } from '@/types/keystone';

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl'] as const;
type Breakpoint = (typeof BREAKPOINTS)[number];

const COLS_MIN = 1;
const COLS_MAX = 12;
const ROWS_MIN = 1;
const ROWS_MAX = 6;

const BREAKPOINT_LABELS: Record<Breakpoint, string> = {
    sm: 'Small',
    md: 'Medium',
    lg: 'Large',
    xl: 'X-Large',
};

type GridConfigMap = Record<Breakpoint, WidgetGridConfig>;

interface WidgetLayoutPopoverProps {
    open: boolean;
    widget: Widget;
    catalog: AvailableWidget;
    dashboardSlug: string;
    onClose: () => void;
}

/**
 * Compact editor for a widget's per-breakpoint grid spans. Issues a PATCH
 * to `dashboards.widgets.layout` on save; the "Reset to default" control
 * sends `reset: true` so the server re-applies the widget class's registered
 * `default_grid_config` instead of having the client guess.
 *
 * Rendered as a centered floating panel (lighter than the schema-driven
 * settings modal) so the layout editor stays distinct from the content
 * settings flow — different trigger icon, different surface.
 */
export function WidgetLayoutPopover({
    open,
    widget,
    catalog,
    dashboardSlug,
    onClose,
}: WidgetLayoutPopoverProps) {
    const initialValues = useMemo<GridConfigMap>(
        () => normalizeGridConfig(widget.grid_config),
        [widget.grid_config],
    );

    const [values, setValues] = useState<GridConfigMap>(initialValues);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const dialogRef = useFocusTrap<HTMLDivElement>(open);

    // Reseed during render when the popover (re-)opens or switches widgets,
    // mirroring the WidgetSettingsModal pattern so stale values never flash.
    const seedSignatureRef = useRef<string | null>(null);
    const seedSignature = open ? widget.id : null;
    if (seedSignatureRef.current !== seedSignature) {
        seedSignatureRef.current = seedSignature;
        if (seedSignature !== null) {
            setValues(initialValues);
            setErrors({});
        }
    }

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
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    const busy = saving || resetting;

    function handleChange(bp: Breakpoint, key: 'cols' | 'rows', raw: string) {
        const parsed = raw === '' ? Number.NaN : Number(raw);
        setValues((current) => ({
            ...current,
            [bp]: { ...current[bp], [key]: parsed },
        }));
        const errorKey = `grid_config.${bp}.${key}`;
        if (errors[errorKey]) {
            setErrors((current) => {
                const next = { ...current };
                delete next[errorKey];
                return next;
            });
        }
    }

    function validate(): Record<string, string> {
        const next: Record<string, string> = {};
        for (const bp of BREAKPOINTS) {
            const { cols, rows } = values[bp];
            if (!Number.isInteger(cols) || cols < COLS_MIN || cols > COLS_MAX) {
                next[`grid_config.${bp}.cols`] = `Cols must be ${COLS_MIN}–${COLS_MAX}.`;
            }
            if (!Number.isInteger(rows) || rows < ROWS_MIN || rows > ROWS_MAX) {
                next[`grid_config.${bp}.rows`] = `Rows must be ${ROWS_MIN}–${ROWS_MAX}.`;
            }
        }
        return next;
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) {
            return;
        }

        const clientErrors = validate();
        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }

        setSaving(true);
        router.patch(
            layoutRoute({ slug: dashboardSlug, id: widget.id }).url,
            { grid_config: values } as never,
            {
                preserveScroll: true,
                preserveState: true,
                only: ['current', 'available_widgets'],
                onSuccess: () => {
                    setErrors({});
                    onClose();
                },
                onError: (responseErrors) => {
                    setErrors(responseErrors as Record<string, string>);
                },
                onFinish: () => setSaving(false),
            },
        );
    }

    function handleReset() {
        if (busy) {
            return;
        }

        const fallback = normalizeGridConfig(
            (catalog.default_grid_config ?? widget.grid_config) as Widget['grid_config'],
        );

        setResetting(true);
        router.patch(
            layoutRoute({ slug: dashboardSlug, id: widget.id }).url,
            { reset: true } as never,
            {
                preserveScroll: true,
                preserveState: true,
                only: ['current', 'available_widgets'],
                onSuccess: () => {
                    // The server response refreshes `widget.grid_config`, which
                    // will reseed the form via the seed-signature pattern; this
                    // local update keeps the inputs accurate if the popover is
                    // closed before the next render.
                    setValues(fallback);
                    setErrors({});
                    onClose();
                },
                onFinish: () => setResetting(false),
            },
        );
    }

    return (
        <div
            className={`pointer-events-none fixed inset-0 z-50 ${open ? '' : 'invisible'}`}
            aria-hidden={!open}
        >
            <button
                type="button"
                aria-label="Close layout editor"
                className={`pointer-events-auto absolute inset-0 bg-black/40 transition-opacity ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
            />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="widget-layout-popover-heading"
                tabIndex={-1}
                className={`pointer-events-auto absolute left-1/2 top-1/2 flex w-[24rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-base-300/60 bg-base-100 shadow-2xl transition-opacity duration-150 focus:outline-none ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
            >
                <header className="flex items-start justify-between gap-4 border-b border-base-300/60 px-5 py-4">
                    <div className="flex flex-col gap-1">
                        <h2
                            id="widget-layout-popover-heading"
                            className="font-display text-base font-semibold text-base-content"
                        >
                            {widget.title} layout
                        </h2>
                        <p className="text-xs text-base-content/65">
                            Set how many columns and rows this widget spans at each breakpoint.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close layout editor"
                        className="rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-base-content"
                        onClick={onClose}
                    >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                            <path
                                d="M6 6l12 12M18 6 6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="px-5 py-4">
                        <table className="w-full table-fixed text-xs">
                            <thead>
                                <tr className="text-left text-[11px] uppercase tracking-wide text-base-content/55">
                                    <th scope="col" className="w-1/3 pb-2 font-semibold">
                                        Breakpoint
                                    </th>
                                    <th scope="col" className="pb-2 font-semibold">
                                        Cols ({COLS_MIN}–{COLS_MAX})
                                    </th>
                                    <th scope="col" className="pb-2 font-semibold">
                                        Rows ({ROWS_MIN}–{ROWS_MAX})
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {BREAKPOINTS.map((bp) => (
                                    <BreakpointRow
                                        key={bp}
                                        bp={bp}
                                        value={values[bp]}
                                        errors={errors}
                                        onChange={(key, raw) => handleChange(bp, key, raw)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {errors.grid_config && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="mx-5 mb-3 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error"
                        >
                            {errors.grid_config}
                        </div>
                    )}

                    <footer className="flex items-center justify-between gap-2 border-t border-base-300/60 px-5 py-3">
                        <button
                            type="button"
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200/60 disabled:opacity-50"
                            onClick={handleReset}
                            disabled={busy}
                        >
                            {resetting ? 'Resetting…' : 'Reset to default'}
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200/60"
                                onClick={onClose}
                                disabled={busy}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-50"
                                disabled={busy}
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
}

interface BreakpointRowProps {
    bp: Breakpoint;
    value: WidgetGridConfig;
    errors: Record<string, string>;
    onChange: (key: 'cols' | 'rows', raw: string) => void;
}

function BreakpointRow({ bp, value, errors, onChange }: BreakpointRowProps) {
    const colsError = errors[`grid_config.${bp}.cols`];
    const rowsError = errors[`grid_config.${bp}.rows`];
    const colsId = `widget-layout-${bp}-cols`;
    const rowsId = `widget-layout-${bp}-rows`;

    return (
        <tr className="align-top">
            <th
                scope="row"
                className="pr-3 pb-3 pt-2 text-left text-xs font-semibold text-base-content/80"
            >
                <span className="block">{BREAKPOINT_LABELS[bp]}</span>
                <span className="block text-[10px] font-normal uppercase tracking-wide text-base-content/45">
                    {bp}
                </span>
            </th>
            <td className="pr-2 pb-3">
                <input
                    id={colsId}
                    aria-label={`${BREAKPOINT_LABELS[bp]} cols`}
                    aria-invalid={colsError ? true : undefined}
                    aria-describedby={colsError ? `${colsId}-error` : undefined}
                    type="number"
                    min={COLS_MIN}
                    max={COLS_MAX}
                    step={1}
                    value={Number.isFinite(value.cols) ? value.cols : ''}
                    onChange={(event) => onChange('cols', event.target.value)}
                    className={`w-full rounded-md border bg-base-100 px-2 py-1.5 text-sm text-base-content focus:border-primary focus:outline-none ${
                        colsError ? 'border-error/60' : 'border-base-300/60'
                    }`}
                />
                {colsError && (
                    <p id={`${colsId}-error`} className="mt-1 text-[10px] text-error">
                        {colsError}
                    </p>
                )}
            </td>
            <td className="pb-3">
                <input
                    id={rowsId}
                    aria-label={`${BREAKPOINT_LABELS[bp]} rows`}
                    aria-invalid={rowsError ? true : undefined}
                    aria-describedby={rowsError ? `${rowsId}-error` : undefined}
                    type="number"
                    min={ROWS_MIN}
                    max={ROWS_MAX}
                    step={1}
                    value={Number.isFinite(value.rows) ? value.rows : ''}
                    onChange={(event) => onChange('rows', event.target.value)}
                    className={`w-full rounded-md border bg-base-100 px-2 py-1.5 text-sm text-base-content focus:border-primary focus:outline-none ${
                        rowsError ? 'border-error/60' : 'border-base-300/60'
                    }`}
                />
                {rowsError && (
                    <p id={`${rowsId}-error`} className="mt-1 text-[10px] text-error">
                        {rowsError}
                    </p>
                )}
            </td>
        </tr>
    );
}

/**
 * Coerce a (possibly partial / stringified) grid_config into the full
 * sm/md/lg/xl shape with integer cols/rows. Missing breakpoints fall back to
 * a 12×1 cell so the form always has something to render rather than crashing
 * on an undefined value.
 */
function normalizeGridConfig(config: Widget['grid_config'] | Record<string, { rows: number; cols: number }>): GridConfigMap {
    const next = {} as GridConfigMap;
    const source =
        config && typeof config === 'object'
            ? (config as Record<string, { cols?: unknown; rows?: unknown }>)
            : ({} as Record<string, { cols?: unknown; rows?: unknown }>);
    for (const bp of BREAKPOINTS) {
        const entry = source[bp];
        const cols = entry && typeof entry.cols === 'number' ? entry.cols : Number(entry?.cols);
        const rows = entry && typeof entry.rows === 'number' ? entry.rows : Number(entry?.rows);
        next[bp] = {
            cols: Number.isFinite(cols) ? Math.trunc(cols) : 12,
            rows: Number.isFinite(rows) ? Math.trunc(rows) : 1,
        };
    }
    return next;
}
