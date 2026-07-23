import type { ReactNode } from 'react';
import type { CustomFieldRecord } from './types';

/**
 * Shared label + description + error frame every custom-field editor
 * renders inside. Keeps the per-type components focused on their input
 * markup and gives the whole custom-fields section a consistent surface.
 */
export function FieldShell({
    field,
    error,
    children,
}: {
    field: CustomFieldRecord;
    error?: string;
    children: ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-base-content/85">
                {field.name}
                {field.required && (
                    <span aria-hidden className="ml-1 text-error">
                        *
                    </span>
                )}
            </span>
            {children}
            {field.description && !error && (
                <span className="text-xs text-base-content/55">
                    {field.description}
                </span>
            )}
            {error && <span className="text-xs text-error">{error}</span>}
        </label>
    );
}
