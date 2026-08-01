import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type HTMLAttributes,
    type ReactNode,
} from 'react';
import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';

export type Tone =
    | 'success'
    | 'info'
    | 'warning'
    | 'error'
    | 'neutral'
    | 'accent'
    | 'primary';

export function BrandMark({
    collapsed = false,
    name,
    logoUrl,
    url,
}: {
    collapsed?: boolean;
    name?: string;
    logoUrl?: string | null;
    url?: string;
}) {
    const title = name?.trim() || 'Keystone';
    const initial = title.charAt(0).toUpperCase() || 'K';

    return (
        <a
            href={url || '/'}
            className="flex items-center gap-2.5 rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
            aria-label={`${title} — visit site homepage`}
        >
            {logoUrl ? (
                <img
                    src={logoUrl}
                    alt={title}
                    className="h-9 w-9 shrink-0 rounded-xl object-contain"
                />
            ) : (
                <span
                    aria-hidden
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary via-primary to-accent font-display text-base font-bold text-white shadow-sm ring-1 ring-inset ring-white/25"
                >
                    {initial}
                </span>
            )}
            {!collapsed && (
                <div className="font-display text-sm font-bold tracking-tight text-[var(--chrome-mark-fg)] leading-tight">
                    {title}
                </div>
            )}
        </a>
    );
}

export const Icon = {
    dashboard: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M3 13h7V3H3v10Zm11 8h7V11h-7v10ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" fill="currentColor" />
        </svg>
    ),
    pages: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 7V3.5L19.5 9Z" fill="currentColor" />
        </svg>
    ),
    posts: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M3 4h18v2H3Zm0 5h18v2H3Zm0 5h12v2H3Zm0 5h12v2H3Z" fill="currentColor" />
        </svg>
    ),
    media: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.9 13.1l2.1 2.5 3.1-4 4 5H5Z" fill="currentColor" />
        </svg>
    ),
    cart: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM7.2 14.6 9 12h7.5a2 2 0 0 0 1.8-1.1L21 5H5.2L4.3 3H1v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7Z" fill="currentColor" />
        </svg>
    ),
    orders: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M19 2H5v20l3-2 3 2 3-2 3 2 2-2Zm-2 8H7V8h10Zm0 4H7v-2h10Z" fill="currentColor" />
        </svg>
    ),
    customers: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-9 2-9 6v2h18v-2c0-4-5-6-9-6Z" fill="currentColor" />
        </svg>
    ),
    forms: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-9 14H6v-2h4Zm0-4H6v-2h4Zm0-4H6V7h4Zm8 8h-6v-2h6Zm0-4h-6v-2h6Zm0-4h-6V7h6Z" fill="currentColor" />
        </svg>
    ),
    site: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm6.9 6h-2.7a15.7 15.7 0 0 0-1.5-3.6A8 8 0 0 1 18.9 8ZM12 4.1a14 14 0 0 1 1.9 3.9h-3.8A14 14 0 0 1 12 4.1ZM4.3 14a8.2 8.2 0 0 1 0-4h3a17 17 0 0 0 0 4Zm.8 2h2.7a15.7 15.7 0 0 0 1.5 3.6A8 8 0 0 1 5.1 16ZM7.8 8H5.1a8 8 0 0 1 4.2-3.6A15.7 15.7 0 0 0 7.8 8ZM12 19.9a14 14 0 0 1-1.9-3.9h3.8A14 14 0 0 1 12 19.9Zm2.3-5.9H9.7a16 16 0 0 1 0-4h4.6a16 16 0 0 1 0 4Zm.4 5.6a15.7 15.7 0 0 0 1.5-3.6h2.7a8 8 0 0 1-4.2 3.6Zm2.6-5.6a17 17 0 0 0 0-4h3a8.2 8.2 0 0 1 0 4Z" fill="currentColor" />
        </svg>
    ),
    settings: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="m19.4 13 2.1 1.6a1 1 0 0 1 .2 1.3l-2 3.4a1 1 0 0 1-1.3.4l-2.5-1a8 8 0 0 1-1.7 1l-.4 2.6a1 1 0 0 1-1 .8h-4a1 1 0 0 1-1-.8l-.4-2.6a8 8 0 0 1-1.7-1l-2.5 1a1 1 0 0 1-1.2-.4l-2-3.4a1 1 0 0 1 .2-1.3L2.6 13a8 8 0 0 1 0-2L.5 9.4a1 1 0 0 1-.2-1.3l2-3.4a1 1 0 0 1 1.2-.4l2.5 1a8 8 0 0 1 1.7-1l.4-2.6A1 1 0 0 1 9 1h4a1 1 0 0 1 1 .8l.4 2.6a8 8 0 0 1 1.7 1l2.5-1a1 1 0 0 1 1.2.4l2 3.4a1 1 0 0 1-.2 1.3L19.4 11a8 8 0 0 1 0 2ZM12 15.5a3.5 3.5 0 1 0-3.5-3.5 3.5 3.5 0 0 0 3.5 3.5Z" fill="currentColor" />
        </svg>
    ),
    users: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M16 14a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3 0-8 1.5-8 4v2h10v-2a4.8 4.8 0 0 1 2-3.8A13 13 0 0 0 8 16Zm8 0a13 13 0 0 0-3.1.4A4.8 4.8 0 0 1 14 20v2h10v-2c0-2.5-5-4-8-4Z" fill="currentColor" />
        </svg>
    ),
    integrations: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M14.4 6.6a3.5 3.5 0 1 0-5 5l1.4 1.4 1.4-1.4-1.4-1.4a1.5 1.5 0 1 1 2.1-2.1l1.4 1.4 1.4-1.4Zm-7 7L6 12.2 4.6 13.6a3.5 3.5 0 1 0 5 5l1.4-1.4-1.4-1.4-1.4 1.4a1.5 1.5 0 1 1-2.1-2.1Zm9 4.4 4-4-1.4-1.4-4 4ZM10.6 13.4 17 7l1.4 1.4-6.4 6.4Z" fill="currentColor" />
        </svg>
    ),
    reports: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M3 3v18h18v-2H5V3Zm6 12h2v-6H9Zm4 0h2V8h-2Zm4 0h2v-9h-2Z" fill="currentColor" />
        </svg>
    ),
    activity: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-[18px] w-[18px]">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    bell: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
            <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 0 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z" fill="currentColor" />
        </svg>
    ),
    search: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    plus: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    chevronLeft: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    chevronRight: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="m10 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    chevronDown: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="m6 10 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    kebab: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M12 7a2 2 0 1 0-2-2 2 2 0 0 0 2 2Zm0 5a2 2 0 1 0-2-2 2 2 0 0 0 2 2Zm0 5a2 2 0 1 0-2-2 2 2 0 0 0 2 2Z" fill="currentColor" />
        </svg>
    ),
    panelLeft: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M9 4v16" stroke="currentColor" strokeWidth="2" />
        </svg>
    ),
    upload: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M12 4v12m0-12-4 4m4-4 4 4M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    eye: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M12 5C5 5 1 12 1 12s4 7 11 7 11-7 11-7-4-7-11-7Zm0 11a4 4 0 1 1 4-4 4 4 0 0 1-4 4Z" fill="currentColor" />
        </svg>
    ),
    edit: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M3 17.2V21h3.8L18 9.8 14.2 6Zm17.7-12.3a1 1 0 0 0 0-1.4l-2.2-2.2a1 1 0 0 0-1.4 0L15 3.4 18.6 7Z" fill="currentColor" />
        </svg>
    ),
    copy: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11Z" fill="currentColor" />
        </svg>
    ),
    trash: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6Zm3-9h6v8H9Zm6.5-6-1-1h-5l-1 1H5v2h14V4Z" fill="currentColor" />
        </svg>
    ),
    sun: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    moon: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="currentColor" />
        </svg>
    ),
    check: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    arrowUp: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3 w-3">
            <path d="M12 5v14M5 12l7-7 7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    arrowDown: (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-3 w-3">
            <path d="M12 19V5M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
} as const;

export interface PageHeaderProps {
    /**
     * Omit when the page renders its own title elsewhere (e.g. the
     * editor screens use a large inline title input in the main
     * column). The header still renders breadcrumbs and actions.
     */
    title?: string;
    description?: string;
    breadcrumbs?: string[];
    actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 border-b border-base-300/60 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
                {breadcrumbs && (
                    <nav className="flex items-center gap-1.5 text-xs font-medium text-base-content/70">
                        {breadcrumbs.map((crumb, idx) => (
                            // Index-prefixed: the crumb text is not unique
                            // (an "Edit" page whose title is also "Edit",
                            // a nested type sharing its parent's name),
                            // and duplicate keys make React drop siblings.
                            <span key={`${idx}-${crumb}`} className="flex items-center gap-1.5">
                                <span className={idx === breadcrumbs.length - 1 ? 'text-base-content' : ''}>
                                    {crumb}
                                </span>
                                {idx < breadcrumbs.length - 1 && (
                                    <span aria-hidden className="text-base-content/60">/</span>
                                )}
                            </span>
                        ))}
                    </nav>
                )}
                {title ? (
                    <h1 className="font-display text-2xl font-bold tracking-tight text-base-content lg:text-[28px]">
                        {title}
                    </h1>
                ) : (
                    // Fallback so screen-reader "jump to headings" still
                    // finds this page. Derived from the last breadcrumb
                    // when the caller omits `title` (editor screens use
                    // an inline title `<input>` in the main column,
                    // which isn't a heading).
                    breadcrumbs && breadcrumbs.length > 0 && (
                        <h1 className="sr-only">{breadcrumbs[breadcrumbs.length - 1]}</h1>
                    )
                )}
                {description && (
                    <p className="max-w-2xl text-sm text-base-content/65">{description}</p>
                )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    padded?: boolean;
}

export function Card({ className = '', children, padded = true, ...rest }: CardProps) {
    return (
        <div
            className={`rounded-[var(--radius-box)] border border-base-300/60 bg-base-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)] ${
                padded ? 'p-5' : ''
            } ${className}`}
            {...rest}
        >
            {children}
        </div>
    );
}

export interface WidgetProps {
    title?: string;
    subtitle?: string;
    action?: ReactNode;
    footer?: ReactNode;
    className?: string;
    children: ReactNode;
    span?: string;
}

export function Widget({ title, subtitle, action, footer, className = '', children, span = '' }: WidgetProps) {
    return (
        <Card padded={false} className={`flex flex-col ${span} ${className}`}>
            {(title || subtitle || action) && (
                <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                    <div className="min-w-0">
                        {title && (
                            <h3 className="font-display text-sm font-semibold tracking-tight text-base-content">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="mt-0.5 text-xs text-base-content/70">{subtitle}</p>
                        )}
                    </div>
                    {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
                </div>
            )}
            <div className="flex-1 px-5 pb-5">{children}</div>
            {footer && (
                <div className="border-t border-base-300/60 px-5 py-3 text-xs text-base-content/65">
                    {footer}
                </div>
            )}
        </Card>
    );
}

export interface StatusBadgeProps {
    status?: string;
    label?: string;
    tone?: Tone;
}

/**
 * Status chip. The tone is carried by the tint, the border, and the dot —
 * never by the label text, which stays `base-content` (#193).
 *
 * Coloured 11px text on its own 10%-opacity tint measured 3.5–4.4:1 in
 * light mode, under the 4.5:1 WCAG 1.4.3 floor. The dot keeps the hue as a
 * visual cue and is `aria-hidden`, so nothing rides on colour alone.
 */
export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
    const toneClass: Record<Tone, string> = {
        success: 'bg-success/15 border-success/45',
        info: 'bg-info/15 border-info/45',
        warning: 'bg-warning/15 border-warning/45',
        error: 'bg-error/15 border-error/45',
        neutral: 'bg-base-200 border-base-300/60',
        accent: 'bg-accent/15 border-accent/45',
        primary: 'bg-primary/15 border-primary/45',
    };

    const dotClass: Record<Tone, string> = {
        success: 'bg-success',
        info: 'bg-info',
        warning: 'bg-warning',
        error: 'bg-error',
        neutral: 'bg-base-content/45',
        accent: 'bg-accent',
        primary: 'bg-primary',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-base-content ${toneClass[tone ?? 'neutral']}`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${dotClass[tone ?? 'neutral']}`}
                aria-hidden
            />
            {label || status}
        </span>
    );
}

export interface KpiTileProps {
    label: string;
    value: string;
    delta?: number;
    deltaLabel?: string;
    icon?: ReactNode;
}

export function KpiTile({ label, value, delta, deltaLabel, icon }: KpiTileProps) {
    const isUp = typeof delta === 'number' ? delta >= 0 : null;

    return (
        <Card padded={false} className="flex items-start gap-4 p-5">
            {icon && (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                    {icon}
                </span>
            )}
            <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-base-content/70">
                    {label}
                </div>
                <div className="mt-1 font-display text-[26px] font-bold tracking-tight text-base-content">
                    {value}
                </div>
                {typeof delta === 'number' && (
                    <div
                        className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${
                            isUp ? 'text-success' : 'text-error'
                        }`}
                    >
                        <span
                            className={`grid h-4 w-4 place-items-center rounded-full ${
                                isUp ? 'bg-success/15' : 'bg-error/15'
                            }`}
                        >
                            {isUp ? Icon.arrowUp : Icon.arrowDown}
                        </span>
                        <span>{Math.abs(delta).toFixed(1)}%</span>
                        {deltaLabel && (
                            <span className="font-medium text-base-content/70">{deltaLabel}</span>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}

export interface DataTableColumn<T> {
    key: string;
    label: string;
    align?: 'left' | 'right';
    muted?: boolean;
    render?: (row: T) => ReactNode;
}

/**
 * A row-level action rendered as a trailing column button.
 * Emitted by `keystone.admin.dataTable.rowActions` (generic) and
 * `keystone.admin.{resource}.dataTable.rowActions` (resource-scoped).
 */
export interface DataTableRowAction<T> {
    key:      string;
    label:    string;
    icon?:    ReactNode;
    onSelect: (row: T) => void;
    /** Predicate that hides the action for rows where it doesn't apply. */
    disabled?: (row: T) => boolean;
}

/**
 * A bulk-selection action. Rendered above the table when at least one
 * bulk action is registered; the header gets a select-all checkbox and
 * each row gets a select-one checkbox.
 * Emitted by `keystone.admin.dataTable.bulkActions` (generic) and
 * `keystone.admin.{resource}.dataTable.bulkActions` (resource-scoped).
 */
export interface DataTableBulkAction<T> {
    key:      string;
    label:    string;
    icon?:    ReactNode;
    onSelect: (rows: T[]) => void;
}

export interface DataTableProps<T> {
    /**
     * Stable identifier for this table's data model (`'posts'`, `'users'`,
     * `'orders'`, …). Used as the scope segment in the resource-scoped
     * filter names, so `<DataTable resource="posts" …>` fires the
     * `keystone.admin.posts.dataTable.columns` filter alongside the
     * generic `keystone.admin.dataTable.columns`. Required so plugins
     * can target a single list page without also matching every other
     * list page.
     */
    resource:   string;
    columns:    Array<DataTableColumn<T>>;
    rows:       T[];
    onRowClick?: (row: T) => void;
    emptyState?: ReactNode;
    /**
     * Current search query string used by the surrounding list page.
     * Piped through `keystone.admin.list.query` (+ resource-scoped
     * alias) so a plugin can observe or rewrite the effective query
     * (redact PII from analytics, translate an aliased command).
     * Pages that don't own a search box can leave this undefined.
     */
    searchQuery?: string;
    /** Fires `.list.query`; pages that let plugins rewrite the query pass this to receive the filtered value. */
    onSearchQueryChange?: (next: string) => void;
}

export function DataTable<T extends { id?: string | number }>({
    resource,
    columns: rawColumns,
    rows: rawRows,
    onRowClick,
    emptyState,
    searchQuery,
    onSearchQueryChange,
}: DataTableProps<T>) {
    // Filter fanout: generic first, then resource-scoped so a plugin can
    // rewrite/re-order everything or narrow its scope to one table.
    // Wrapped in useMemo so filter chains only run when the input identity
    // changes; late-registered callbacks pick up on the next parent render.
    const columns = useMemo(
        () => applyFilters<Array<DataTableColumn<T>>>(
            `keystone.admin.${resource}.dataTable.columns`,
            applyFilters<Array<DataTableColumn<T>>>('keystone.admin.dataTable.columns', rawColumns, resource),
            resource,
        ),
        [rawColumns, resource],
    );
    const rows = useMemo(
        () => applyFilters<T[]>(
            `keystone.admin.${resource}.dataTable.rows`,
            applyFilters<T[]>('keystone.admin.dataTable.rows', rawRows, resource),
            resource,
        ),
        [rawRows, resource],
    );
    const rowActions = useMemo(
        () => applyFilters<Array<DataTableRowAction<T>>>(
            `keystone.admin.${resource}.dataTable.rowActions`,
            applyFilters<Array<DataTableRowAction<T>>>('keystone.admin.dataTable.rowActions', [], resource),
            resource,
        ),
        [resource],
    );
    const bulkActions = useMemo(
        () => applyFilters<Array<DataTableBulkAction<T>>>(
            `keystone.admin.${resource}.dataTable.bulkActions`,
            applyFilters<Array<DataTableBulkAction<T>>>('keystone.admin.dataTable.bulkActions', [], resource),
            resource,
        ),
        [resource],
    );
    // `.list.tabs` — plugin-injected tab strip rendered above the table.
    // Starts as `null`; plugins can return any ReactNode. Both fire so
    // a plugin can decorate every list page uniformly OR narrow to one
    // resource. Args: `(ReactNode, resource)`.
    const tabsSlot = useMemo(
        () => applyFilters<ReactNode>(
            `keystone.admin.${resource}.list.tabs`,
            applyFilters<ReactNode>('keystone.admin.list.tabs', null, resource),
            resource,
        ),
        [resource],
    );
    // `.list.filters` — plugin-injected filter chips row (advanced
    // filters, saved views). Args: `(ReactNode, resource)`.
    const filtersSlot = useMemo(
        () => applyFilters<ReactNode>(
            `keystone.admin.${resource}.list.filters`,
            applyFilters<ReactNode>('keystone.admin.list.filters', null, resource),
            resource,
        ),
        [resource],
    );
    // `.list.header.actions` — plugin-injected buttons at the top-right
    // of the list header (bulk import, export, sync). Args:
    // `(ReactNode, resource)`.
    const headerActionsSlot = useMemo(
        () => applyFilters<ReactNode>(
            `keystone.admin.${resource}.list.header.actions`,
            applyFilters<ReactNode>('keystone.admin.list.header.actions', null, resource),
            resource,
        ),
        [resource],
    );
    // `.list.query` — filters the caller-supplied search string on
    // every render. Any string return value is written back through
    // `onSearchQueryChange` on change. A non-string return value
    // (misbehaving plugin) is coerced back to the original query
    // string — the guard below prevents a `false` / `undefined` from
    // ever reaching the caller's controlled input state. Args:
    // `(string, resource)`.
    const filteredQuery = useMemo(() => {
        const raw = applyFilters<unknown>(
            `keystone.admin.${resource}.list.query`,
            applyFilters<unknown>('keystone.admin.list.query', searchQuery ?? '', resource),
            resource,
        );
        return typeof raw === 'string' ? raw : (searchQuery ?? '');
    }, [searchQuery, resource]);
    // Feedback-loop guard: once we emit a rewritten value to the
    // parent, it becomes the next `searchQuery`, which flows back
    // through the same filter chain. Without tracking the last emit,
    // a plugin like `q => q + ' status:active'` would append on every
    // pass and never converge. `lastEmittedRef` remembers the last
    // value we asked the parent to adopt so we can short-circuit the
    // follow-up render where the parent hands that value back. React-
    // safe: `useEffect` runs after commit so the parent's setState
    // never races with our render.
    const lastEmittedRef = useRef<string | null>(null);
    useEffect(() => {
        if (
            onSearchQueryChange &&
            searchQuery !== undefined &&
            filteredQuery !== searchQuery &&
            filteredQuery !== lastEmittedRef.current
        ) {
            lastEmittedRef.current = filteredQuery;
            onSearchQueryChange(filteredQuery);
        }
    }, [filteredQuery, searchQuery, onSearchQueryChange]);

    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

    // `.list.selectionChange` — fires per-render whenever the selected
    // row-id set changes identity so a plugin can react to the current
    // multi-select (enable a header button, sync a URL fragment). Both
    // generic and resource-scoped variants fire. Args:
    // `(Set<string|number>, resource)`.
    useEffect(() => {
        doAction('keystone.admin.list.selectionChange', selectedIds, resource);
        doAction(`keystone.admin.${resource}.list.selectionChange`, selectedIds, resource);
    }, [selectedIds, resource]);

    // When rows change (filter/sort/paginate), intersect the current
    // selection with the new row-id set so a bulk-action callback can
    // never receive an id that no longer exists in the visible rows.
    // Row identity — not just length — is the trigger; a same-length
    // reshuffle would otherwise keep a stale id whose backing row is
    // gone.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync of external rows-prop identity to local selection set
        setSelectedIds((prev) => {
            if (prev.size === 0) return prev;
            const visible = new Set<string | number>();
            for (const r of rows) {
                if (r.id !== undefined) visible.add(r.id);
            }
            let changed = false;
            const next = new Set<string | number>();
            for (const id of prev) {
                if (visible.has(id)) {
                    next.add(id);
                } else {
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [rows]);

    if (!rows || rows.length === 0) {
        // `.list.empty` — filter the empty-state node so a plugin can
        // rewrite the pitch (e.g. show a "Get started with the sample
        // dataset" CTA when the count is zero AND a flag is on).
        // Args: `(ReactNode, resource)`.
        const baseEmpty = emptyState ?? <EmptyState title="No records yet" />;
        const rewritten = applyFilters<ReactNode>(
            `keystone.admin.${resource}.list.empty`,
            applyFilters<ReactNode>('keystone.admin.list.empty', baseEmpty, resource),
            resource,
        );
        return <>{rewritten}</>;
    }

    // Wrap the caller's row-click handler with the `.list.rowClick`
    // action so plugins can observe (analytics, undo-stack recording)
    // without wrapping the DataTable. Fires only when a row-click was
    // provided so tables that are display-only still don't fire a
    // spurious per-row event. Args: `(row, resource)`.
    const handleRowClick = onRowClick
        ? (row: T) => {
            doAction('keystone.admin.list.rowClick', row, resource);
            doAction(`keystone.admin.${resource}.list.rowClick`, row, resource);
            onRowClick(row);
        }
        : undefined;

    const hasBulk    = bulkActions.length > 0;
    const hasActions = rowActions.length > 0;

    const allSelected = hasBulk && rows.every((r) => r.id !== undefined && selectedIds.has(r.id));

    function toggleAll() {
        setSelectedIds((prev) => {
            if (prev.size === rows.length) {
                return new Set();
            }
            const next = new Set<string | number>();
            for (const r of rows) {
                if (r.id !== undefined) next.add(r.id);
            }
            return next;
        });
    }

    function toggleOne(id: string | number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    const selectedRows = hasBulk ? rows.filter((r) => r.id !== undefined && selectedIds.has(r.id)) : [];

    return (
        <div className="overflow-x-auto">
            {(tabsSlot || filtersSlot || headerActionsSlot) && (
                <div className="mb-3 flex flex-col gap-2">
                    {(tabsSlot || headerActionsSlot) && (
                        <div className="flex items-center justify-between gap-2">
                            <div>{tabsSlot}</div>
                            <div className="flex items-center gap-2">{headerActionsSlot}</div>
                        </div>
                    )}
                    {filtersSlot && <div>{filtersSlot}</div>}
                </div>
            )}
            {hasBulk && selectedRows.length > 0 && (
                <div className="mb-2 flex items-center gap-2 rounded-md border border-base-300/60 bg-base-200/40 px-3 py-2 text-xs">
                    <span className="font-semibold">{selectedRows.length} selected</span>
                    {bulkActions.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() => action.onSelect(selectedRows)}
                            className="rounded-md border border-base-300/60 bg-base-100 px-2 py-1 font-medium hover:bg-base-200"
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-base-300/60 text-[11px] font-semibold tracking-[0.08em] uppercase text-base-content/70">
                        {hasBulk && (
                            <th className="w-8 px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    aria-label="Select all rows"
                                />
                            </th>
                        )}
                        {columns.map((col) => (
                            <th key={col.key} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}>
                                {col.label}
                            </th>
                        ))}
                        {hasActions && <th className="w-8 px-4 py-3 text-right" />}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr
                            key={row.id ?? idx}
                            onClick={handleRowClick ? () => handleRowClick(row) : undefined}
                            onKeyDown={
                                handleRowClick
                                    ? (e) => {
                                          // Keyboard activation on nested
                                          // controls (bulk-select checkbox,
                                          // row-action buttons) bubbles a
                                          // Space/Enter keydown up to the
                                          // row. Those controls only stop
                                          // click propagation, not keydown,
                                          // so without this guard hitting
                                          // Space to toggle a checkbox
                                          // would fire the row's onRowClick
                                          // navigation AND suppress the
                                          // checkbox toggle via
                                          // preventDefault.
                                          if (e.target !== e.currentTarget) return;
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              handleRowClick(row);
                                          }
                                      }
                                    : undefined
                            }
                            role={handleRowClick ? 'button' : undefined}
                            tabIndex={handleRowClick ? 0 : undefined}
                            className={`border-b border-base-300/40 last:border-b-0 ${
                                handleRowClick
                                    ? 'cursor-pointer hover:bg-base-200/60 focus:bg-base-200/60 focus:outline-2 focus:outline-primary'
                                    : ''
                            }`}
                        >
                            {hasBulk && (
                                <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={row.id !== undefined && selectedIds.has(row.id)}
                                        onChange={() => row.id !== undefined && toggleOne(row.id)}
                                        aria-label={`Select row ${row.id ?? idx}`}
                                    />
                                </td>
                            )}
                            {columns.map((col) => (
                                <td
                                    key={col.key}
                                    className={`px-4 py-3 align-middle ${
                                        col.align === 'right' ? 'text-right' : ''
                                    } ${col.muted ? 'text-base-content/65' : 'text-base-content'}`}
                                >
                                    {col.render
                                        ? col.render(row)
                                        : ((row as Record<string, ReactNode>)[col.key] ?? null)}
                                </td>
                            ))}
                            {hasActions && (
                                <td className="px-4 py-3 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1">
                                        {rowActions.map((action) => {
                                            const disabled = action.disabled?.(row) === true;
                                            return (
                                                <button
                                                    key={action.key}
                                                    type="button"
                                                    onClick={() => !disabled && action.onSelect(row)}
                                                    disabled={disabled}
                                                    className="rounded-md p-1.5 text-base-content/60 hover:bg-base-200 hover:text-base-content disabled:opacity-40"
                                                    aria-label={action.label}
                                                    title={action.label}
                                                >
                                                    {action.icon ?? action.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export interface EmptyStateProps {
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="font-display text-base font-semibold text-base-content">{title}</div>
            {description && (
                <p className="max-w-md text-sm text-base-content/60">{description}</p>
            )}
            {action}
        </div>
    );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-[var(--chrome-input-border)] bg-[var(--chrome-input-bg)] px-3 text-sm text-[var(--chrome-fg-muted)] transition-colors hover:bg-[var(--chrome-hover-bg)]"
        >
            <span className="text-[var(--chrome-fg-subtle)]">{Icon.search}</span>
            <span className="flex-1 text-left">Search anything…</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-[var(--chrome-input-border)] bg-[var(--chrome-hover-bg)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--chrome-fg-muted)] sm:inline-flex">
                <span>⌘</span>
                <span>K</span>
            </kbd>
        </button>
    );
}

export function ThemeButton({
    resolvedColorScheme,
    onToggle,
}: {
    resolvedColorScheme: 'light' | 'dark';
    onToggle: () => void;
}) {
    const isDark = resolvedColorScheme === 'dark';
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--chrome-input-border)] bg-[var(--chrome-input-bg)] text-[var(--chrome-fg-muted)] hover:bg-[var(--chrome-hover-bg)] hover:text-[var(--chrome-fg)]"
        >
            {isDark ? Icon.sun : Icon.moon}
        </button>
    );
}

export function NotificationsBell({
    unreadCount,
    panel,
    open,
    onOpenChange,
}: {
    unreadCount: number;
    panel: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onOpenChange(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, onOpenChange]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                aria-label={`Notifications (${unreadCount} unread)`}
                className="relative grid h-9 w-9 place-items-center overflow-visible rounded-lg border border-[var(--chrome-input-border)] bg-[var(--chrome-input-bg)] text-[var(--chrome-fg-muted)] hover:bg-[var(--chrome-hover-bg)] hover:text-[var(--chrome-fg)]"
            >
                {Icon.bell}
                {unreadCount > 0 && (
                    <span className="pointer-events-none absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] font-bold text-accent-content ring-2 ring-[var(--chrome-bg)]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            {open && (
                <div className="absolute right-0 z-30 mt-2 w-[380px] origin-top-right rounded-[var(--radius-box)] border border-base-300/60 bg-base-100 shadow-xl">
                    {panel}
                </div>
            )}
        </div>
    );
}

export interface CommandPaletteItem {
    label: string;
    kind: string;
    icon: ReactNode;
    onSelect: () => void;
}

export function CommandPalette({
    open,
    onOpenChange,
    items,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CommandPaletteItem[];
}) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onOpenChange(false);
        }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onOpenChange]);

    useEffect(() => {
        if (open && inputRef.current) {
            inputRef.current.focus();
        }
    }, [open]);

    if (!open) return null;

    // `keystone.admin.commandPalette.search` — plugins can rewrite the
    // typed query before it's matched against item labels (add fuzzy
    // matching, expand shorthand, redirect certain prefixes). Args:
    // `(string, { items })`. Empty string is passed through so a plugin
    // can also inject a default-visible slice by returning a stub query.
    const rewritten = applyFilters<string>('keystone.admin.commandPalette.search', query, { items });
    const filtered = rewritten
        ? items.filter((it) => it.label.toLowerCase().includes(rewritten.toLowerCase()))
        : items;

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-start bg-neutral/40 px-4 pt-[10vh] backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
        >
            <div
                className="w-full max-w-xl overflow-hidden rounded-[var(--radius-box)] border border-base-300/60 bg-base-100 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-base-300/60 px-4 py-3">
                    <span className="text-base-content/60">{Icon.search}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type a command, page, or content title…"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/40"
                    />
                    <kbd className="rounded border border-base-300/60 bg-base-200 px-1.5 py-0.5 font-mono text-[10px] text-base-content/65">
                        ESC
                    </kbd>
                </div>
                <div className="max-h-[60vh] overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-base-content/70">
                            No matches for &quot;{query}&quot;.
                        </div>
                    ) : (
                        filtered.map((it, idx) => (
                            <button
                                key={`${it.label}-${idx}`}
                                type="button"
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-base-200/60"
                                onClick={() => {
                                    onOpenChange(false);
                                    it.onSelect();
                                }}
                            >
                                <span className="grid h-7 w-7 place-items-center rounded-md bg-base-200 text-base-content/65">
                                    {it.icon}
                                </span>
                                <span className="flex-1 text-base-content">{it.label}</span>
                                <span className="rounded border border-base-300/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-base-content/70">
                                    {it.kind}
                                </span>
                            </button>
                        ))
                    )}
                </div>
                <div className="flex items-center justify-between border-t border-base-300/60 bg-base-200/40 px-4 py-2 text-[11px] text-base-content/70">
                    <span>Click a result · ESC to close</span>
                    <span className="font-mono">{filtered.length} results</span>
                </div>
            </div>
        </div>
    );
}
