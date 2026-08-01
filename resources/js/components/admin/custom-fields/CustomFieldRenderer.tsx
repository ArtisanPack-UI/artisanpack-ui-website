import { createElement, type ComponentType, type ReactNode } from 'react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
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
    // `keystone.admin.customFields.registerType` — resolves a field-type
    // slug (built-in cases like `text`, `image`, OR a plugin's
    // `editor_component` identifier) to a React editor component.
    // Callbacks receive the currently-resolved component (or `undefined`
    // when the field type is unknown) plus the field record, and return
    // the component they want mounted. Runs on every render so a plugin
    // bundle registered mid-session picks up on the next commit — the
    // filter itself is the resolution primitive, so plugins don't need
    // to reach into a private registry to introduce a new type.
    // Args: `(ComponentType | undefined, { field, type, source })` where
    // `source` is `'custom'`, `'builtin'`, or `'unknown'` — subscribers
    // can decide whether to shadow a built-in or only fill the unknown
    // gap.
    const custom = field.editor_component ? CUSTOM_EDITORS[field.editor_component] : undefined;
    const builtin = BUILTIN_EDITORS[field.type];
    const initial = custom ?? builtin;
    const source: 'custom' | 'builtin' | 'unknown' = custom
        ? 'custom'
        : builtin
            ? 'builtin'
            : 'unknown';
    // `Resolved` is a stable component reference resolved through the
    // filter chain, NOT a component constructed here — subscribers
    // register their component at module scope and the filter returns
    // that same reference on every call.
    const Resolved = applyFilters<ComponentType<CustomFieldEditorProps> | undefined>(
        'keystone.admin.customFields.registerType',
        initial,
        { field, type: field.editor_component ?? field.type, source },
    );

    // `.customFields.validate` — filters the per-field error string
    // before it's passed down to the editor. Plugins can inject a
    // client-side validation message (or clear one) without waiting for
    // the server round-trip. Args: `(string | undefined, { field, value })`;
    // return `undefined` to clear.
    const filteredError = applyFilters<string | undefined>(
        'keystone.admin.customFields.validate',
        error,
        { field, value },
    );

    const rendered: ReactNode = Resolved
        ? createElement(Resolved, {
            field,
            value,
            error: filteredError,
            onChange,
        })
        : (
            <UnknownFieldFallback
                field={field}
                value={value}
                error={filteredError}
                onChange={onChange}
            />
        );

    // `.customFields.render` — final wrapper over every field editor.
    // Plugins can decorate (add a help chip, wrap in a permission gate)
    // or replace the rendered node outright. Args:
    // `(ReactNode, { field, value, error })`.
    return applyFilters<ReactNode>(
        'keystone.admin.customFields.render',
        rendered,
        { field, value, error: filteredError },
    );
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
