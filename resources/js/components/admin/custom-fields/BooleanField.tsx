import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

/**
 * On/off toggle for the `boolean` and `checkbox` custom-field types.
 * The visual affordance is the same — a single labeled checkbox — so
 * both types render through this component.
 */
export default function BooleanField({ field, value, error, onChange }: CustomFieldEditorProps) {
    const checked = coerce(value);

    return (
        <FieldShell field={field} error={error}>
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border border-base-300/60 bg-base-100 accent-primary"
                />
                <span className="text-sm text-base-content/75">
                    {checked ? 'On' : 'Off'}
                </span>
            </div>
        </FieldShell>
    );
}

function coerce(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase());
    return false;
}
