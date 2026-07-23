import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

/**
 * Persists a file reference as a plain URL / identifier string. Actual
 * uploads run through the media library; this field just captures the
 * chosen reference so the record has something to render server-side.
 * A richer picker can ship later without changing the value contract.
 */
export default function FileField({ field, value, error, onChange }: CustomFieldEditorProps) {
    const stringValue = value === null || value === undefined ? '' : String(value);

    return (
        <FieldShell field={field} error={error}>
            <input
                type="text"
                value={stringValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder="/path/to/file or https://…"
                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 font-mono text-xs outline-none focus:border-primary"
            />
        </FieldShell>
    );
}
