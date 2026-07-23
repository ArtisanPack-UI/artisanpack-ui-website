import {
    useEffect,
    useRef,
    useState,
    type HTMLAttributes,
    type ReactNode,
} from 'react';

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
    title: string;
    description?: string;
    breadcrumbs?: string[];
    actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 border-b border-base-300/60 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
                {breadcrumbs && (
                    <nav className="flex items-center gap-1.5 text-xs font-medium text-base-content/55">
                        {breadcrumbs.map((crumb, idx) => (
                            <span key={crumb} className="flex items-center gap-1.5">
                                <span className={idx === breadcrumbs.length - 1 ? 'text-base-content' : ''}>
                                    {crumb}
                                </span>
                                {idx < breadcrumbs.length - 1 && (
                                    <span className="text-base-content/30">/</span>
                                )}
                            </span>
                        ))}
                    </nav>
                )}
                <h1 className="font-display text-2xl font-bold tracking-tight text-base-content lg:text-[28px]">
                    {title}
                </h1>
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
                            <p className="mt-0.5 text-xs text-base-content/55">{subtitle}</p>
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

export function StatusBadge({ status, label, tone }: StatusBadgeProps) {
    const toneClass: Record<Tone, string> = {
        success: 'bg-success/10 text-success border-success/20',
        info: 'bg-info/10 text-info border-info/20',
        warning: 'bg-warning/15 text-warning border-warning/25',
        error: 'bg-error/10 text-error border-error/20',
        neutral: 'bg-base-200 text-base-content/70 border-base-300/60',
        accent: 'bg-accent/15 text-accent border-accent/30',
        primary: 'bg-primary/10 text-primary border-primary/20',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${toneClass[tone ?? 'neutral']}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
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
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-base-content/55">
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
                            <span className="font-medium text-base-content/55">{deltaLabel}</span>
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

export interface DataTableProps<T> {
    columns: Array<DataTableColumn<T>>;
    rows: T[];
    onRowClick?: (row: T) => void;
    emptyState?: ReactNode;
}

export function DataTable<T extends { id?: string | number }>({
    columns,
    rows,
    onRowClick,
    emptyState,
}: DataTableProps<T>) {
    if (!rows || rows.length === 0) {
        return <>{emptyState ?? <EmptyState title="No records yet" />}</>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-base-300/60 text-[11px] font-semibold tracking-[0.08em] uppercase text-base-content/55">
                        {columns.map((col) => (
                            <th key={col.key} className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}>
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr
                            key={row.id ?? idx}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            onKeyDown={
                                onRowClick
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              onRowClick(row);
                                          }
                                      }
                                    : undefined
                            }
                            role={onRowClick ? 'button' : undefined}
                            tabIndex={onRowClick ? 0 : undefined}
                            className={`border-b border-base-300/40 last:border-b-0 ${
                                onRowClick
                                    ? 'cursor-pointer hover:bg-base-200/60 focus:bg-base-200/60 focus:outline-2 focus:outline-primary'
                                    : ''
                            }`}
                        >
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

    const filtered = query
        ? items.filter((it) => it.label.toLowerCase().includes(query.toLowerCase()))
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
                    <span className="text-base-content/45">{Icon.search}</span>
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
                        <div className="px-4 py-8 text-center text-sm text-base-content/55">
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
                                <span className="rounded border border-base-300/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-base-content/55">
                                    {it.kind}
                                </span>
                            </button>
                        ))
                    )}
                </div>
                <div className="flex items-center justify-between border-t border-base-300/60 bg-base-200/40 px-4 py-2 text-[11px] text-base-content/55">
                    <span>Click a result · ESC to close</span>
                    <span className="font-mono">{filtered.length} results</span>
                </div>
            </div>
        </div>
    );
}
