import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

type SelectOption = { value: string; label: string };

export default function SelectField({ field, value, error, onChange }: CustomFieldEditorProps) {
    const options = readOptions(field.options);
    const stringValue = value === null || value === undefined ? '' : String(value);

    return (
        <FieldShell field={field} error={error}>
            <select
                value={stringValue}
                onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
            >
                {!field.required && <option value="">— None —</option>}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </FieldShell>
    );
}

/**
 * Accepts several `options` shapes so plugin authors don't need to
 * know Keystone's internal shape:
 *  - `[{value, label}, ...]`
 *  - `{key: 'label', ...}` — value=key, label=value
 *  - `['a', 'b']` — value=item, label=item
 *  - `{choices: [...]}` — same list of shapes above
 */
function readOptions(options: Record<string, unknown> | null): SelectOption[] {
    if (!options) return [];

    const raw = Array.isArray((options as { choices?: unknown }).choices)
        ? (options as { choices: unknown[] }).choices
        : options;

    if (Array.isArray(raw)) {
        return raw.map((item) => normalizeOption(item)).filter(Boolean) as SelectOption[];
    }

    return Object.entries(raw).map(([key, label]) => ({
        value: String(key),
        label: String(label ?? key),
    }));
}

function normalizeOption(item: unknown): SelectOption | null {
    if (typeof item === 'string' || typeof item === 'number') {
        return { value: String(item), label: String(item) };
    }
    if (item && typeof item === 'object' && 'value' in item) {
        const value = (item as { value: unknown }).value;
        const label = (item as { label?: unknown }).label ?? value;
        return { value: String(value), label: String(label) };
    }
    return null;
}
