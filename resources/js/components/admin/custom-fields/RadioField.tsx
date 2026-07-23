import { useId } from 'react';
import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

type RadioOption = { value: string; label: string };

export default function RadioField({ field, value, error, onChange }: CustomFieldEditorProps) {
    const options = readOptions(field.options);
    const stringValue = value === null || value === undefined ? '' : String(value);
    const groupName = useId();

    return (
        <FieldShell field={field} error={error}>
            <div className="flex flex-col gap-1.5">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className="flex items-center gap-2 text-sm text-base-content/85"
                    >
                        <input
                            type="radio"
                            name={groupName}
                            value={option.value}
                            checked={stringValue === option.value}
                            onChange={(e) => onChange(e.target.value)}
                            className="h-4 w-4 accent-primary"
                        />
                        <span>{option.label}</span>
                    </label>
                ))}
            </div>
        </FieldShell>
    );
}

function readOptions(options: Record<string, unknown> | null): RadioOption[] {
    if (!options) return [];

    const raw = Array.isArray((options as { choices?: unknown }).choices)
        ? (options as { choices: unknown[] }).choices
        : options;

    if (Array.isArray(raw)) {
        return raw
            .map((item) => {
                if (typeof item === 'string' || typeof item === 'number') {
                    return { value: String(item), label: String(item) };
                }
                if (item && typeof item === 'object' && 'value' in item) {
                    const v = (item as { value: unknown }).value;
                    const l = (item as { label?: unknown }).label ?? v;
                    return { value: String(v), label: String(l) };
                }
                return null;
            })
            .filter(Boolean) as RadioOption[];
    }

    return Object.entries(raw).map(([key, label]) => ({
        value: String(key),
        label: String(label ?? key),
    }));
}
