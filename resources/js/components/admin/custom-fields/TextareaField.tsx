import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

export default function TextareaField({ field, value, error, onChange }: CustomFieldEditorProps) {
    const stringValue = value === null || value === undefined ? '' : String(value);

    return (
        <FieldShell field={field} error={error}>
            <textarea
                rows={4}
                value={stringValue}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary"
            />
        </FieldShell>
    );
}
