import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Field({
    label,
    helper,
    error,
    required,
    htmlFor,
    children,
}: {
    label: string;
    helper?: string;
    error?: string;
    required?: boolean;
    htmlFor?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-xs font-semibold text-base-content">
                {label}
                {required && <span className="ml-0.5 text-error">*</span>}
            </label>
            {children}
            {error ? (
                <span className="text-[11px] text-error">{error}</span>
            ) : helper ? (
                <span className="text-[11px] text-base-content/55">{helper}</span>
            ) : null}
        </div>
    );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
    const { className = '', ...rest } = props;
    return (
        <input
            type={rest.type ?? 'text'}
            className={`h-9 rounded-lg border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary ${className}`}
            {...rest}
        />
    );
}

export function CheckboxList({
    options,
    selected,
    onToggle,
    error,
}: {
    options: Array<{ slug: string; name: string; description?: string | null }>;
    selected: string[];
    onToggle: (slug: string) => void;
    error?: string;
}) {
    return (
        <div>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-base-300/60 bg-base-100 p-3">
                {options.length === 0 && (
                    <span className="text-xs text-base-content/45">No options available.</span>
                )}
                {options.map((opt) => (
                    <label
                        key={opt.slug}
                        className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 hover:bg-base-200/60"
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(opt.slug)}
                            onChange={() => onToggle(opt.slug)}
                            className="mt-0.5 h-4 w-4 rounded border-base-300/60 text-primary focus:ring-primary"
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-base-content">
                                {opt.name}{' '}
                                <code className="text-[11px] font-normal text-base-content/55">
                                    {opt.slug}
                                </code>
                            </span>
                            {opt.description && (
                                <span className="block text-[11px] text-base-content/55">
                                    {opt.description}
                                </span>
                            )}
                        </span>
                    </label>
                ))}
            </div>
            {error && <p className="mt-1.5 text-[11px] text-error">{error}</p>}
        </div>
    );
}

export function PrimaryButton({
    children,
    loading,
    className = '',
    type = 'submit',
    disabled,
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; loading?: boolean }) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
            {...rest}
        >
            {loading && (
                <span
                    aria-hidden
                    className="h-3 w-3 animate-spin rounded-full border-2 border-primary-content/60 border-t-transparent"
                />
            )}
            {children}
        </button>
    );
}

export function DangerButton({
    children,
    className = '',
    type = 'button',
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
    return (
        <button
            type={type}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-error px-4 py-2 text-xs font-semibold text-error-content shadow-sm hover:bg-error/90 ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
