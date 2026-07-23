import type { HTMLInputTypeAttribute } from 'react';
import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

/**
 * Renders a plain `<input>` for the text-shaped custom-field types
 * (text, email, url, tel, number, date, datetime, time, color). Each
 * per-type component is a thin wrapper that passes the matching HTML
 * input type through — no bespoke UI, so the shared shell keeps the
 * markup consistent and prevents drift between similar fields.
 */
export function SimpleInputField({
    field,
    value,
    error,
    onChange,
    inputType,
    inputMode,
    step,
}: CustomFieldEditorProps & {
    inputType: HTMLInputTypeAttribute;
    inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    step?: number | string;
}) {
    const stringValue = valueToString(value);

    return (
        <FieldShell field={field} error={error}>
            <input
                type={inputType}
                value={stringValue}
                inputMode={inputMode}
                step={step}
                onChange={(e) => onChange(coerce(inputType, e.target.value))}
                className={
                    inputType === 'color'
                        ? 'h-9 w-16 cursor-pointer rounded-md border border-base-300/60 bg-base-100 p-1'
                        : 'h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary'
                }
            />
        </FieldShell>
    );
}

function valueToString(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
}

/**
 * Coerce a raw `<input>` string into the value the server expects. Only
 * `number` inputs get numeric coercion — a `date`/`time` string round-
 * trips as-is because Laravel's `date`/`time` validators accept the
 * ISO-ish format the browser produces.
 */
function coerce(inputType: HTMLInputTypeAttribute, raw: string): unknown {
    if (inputType === 'number') {
        return raw === '' ? null : Number(raw);
    }
    return raw;
}
