import type { ComponentType } from 'react';
import type { CustomFieldEditorProps, CustomFieldRecord } from './types';
import { FieldShell } from './FieldShell';

import BooleanField from './BooleanField';
import CheckboxField from './CheckboxField';
import ColorField from './ColorField';
import DateField from './DateField';
import DatetimeField from './DatetimeField';
import EmailField from './EmailField';
import FileField from './FileField';
import ImageField from './ImageField';
import NumberField from './NumberField';
import RadioField from './RadioField';
import SelectField from './SelectField';
import TelField from './TelField';
import TextField from './TextField';
import TextareaField from './TextareaField';
import TimeField from './TimeField';
import UrlField from './UrlField';

/**
 * Dispatch table for the framework's built-in `FieldType` cases. Each
 * component owns its own markup and validation UX; the renderer only
 * decides which one to mount.
 */
const BUILTIN_EDITORS: Record<string, ComponentType<CustomFieldEditorProps>> = {
    text: TextField,
    textarea: TextareaField,
    number: NumberField,
    select: SelectField,
    checkbox: CheckboxField,
    radio: RadioField,
    boolean: BooleanField,
    date: DateField,
    datetime: DatetimeField,
    time: TimeField,
    email: EmailField,
    url: UrlField,
    tel: TelField,
    color: ColorField,
    file: FileField,
    image: ImageField,
};

/**
 * Runtime registry of custom `editor_component` identifiers plugins can
 * register from their bundle. When a field ships with an
 * `editor_component` that isn't in the built-ins, the renderer looks it
 * up here before falling back to the unknown-type placeholder.
 */
const CUSTOM_EDITORS: Record<string, ComponentType<CustomFieldEditorProps>> = {};

/**
 * Register a plugin-supplied field editor component. Plugin bundles
 * call this once at boot so the renderer can dispatch to their custom
 * type without another round trip.
 */
export function registerCustomFieldEditor(
    identifier: string,
    component: ComponentType<CustomFieldEditorProps>,
): void {
    CUSTOM_EDITORS[identifier] = component;
}

/**
 * Renders the editor for a single custom field. Dispatch order:
 *  1. Plugin-registered `editor_component` identifier
 *  2. Built-in `FieldType` case
 *  3. Fallback text input with a "unknown field type" warning
 */
export function CustomFieldRenderer({
    field,
    value,
    error,
    onChange,
}: {
    field: CustomFieldRecord;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
}) {
    const custom = field.editor_component ? CUSTOM_EDITORS[field.editor_component] : undefined;
    if (custom) {
        const Custom = custom;
        return <Custom field={field} value={value} error={error} onChange={onChange} />;
    }

    const builtin = BUILTIN_EDITORS[field.type];
    if (builtin) {
        const Builtin = builtin;
        return <Builtin field={field} value={value} error={error} onChange={onChange} />;
    }

    return <UnknownFieldFallback field={field} value={value} error={error} onChange={onChange} />;
}

function UnknownFieldFallback({ field, value, error, onChange }: CustomFieldEditorProps) {
    const stringValue = value === null || value === undefined ? '' : String(value);

    return (
        <FieldShell
            field={field}
            error={
                error ??
                `Unknown field type "${field.type}" — showing a text input as fallback. Register the type via the field-type registry to get a bespoke editor.`
            }
        >
            <input
                type="text"
                value={stringValue}
                onChange={(e) => onChange(e.target.value)}
                className="h-9 w-full rounded-md border border-warning/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
            />
        </FieldShell>
    );
}
