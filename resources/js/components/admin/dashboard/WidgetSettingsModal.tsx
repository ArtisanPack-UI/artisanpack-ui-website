import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import { update as updateWidget } from '@/routes/admin/dashboards/widgets';
import { useFocusTrap } from '@/lib/admin/useFocusTrap';
import type { AvailableWidget, Widget, WidgetOptions } from '@/types/keystone';

/**
 * Field-type union the modal can render. Schemas declared on the server
 * (`KeystoneAdminWidgetInterface::extendedInfo()`) emit one of these strings;
 * unknown types render as a disabled diagnostic row rather than silently
 * dropping the field so authors notice the typo.
 */
type FieldType = 'text' | 'number' | 'select' | 'toggle' | 'multiselect';

interface SelectOption {
    value: string;
    label: string;
}

interface SchemaField {
    name: string;
    label: string;
    type: FieldType | string;
    default?: unknown;
    description?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: SelectOption[];
}

interface SettingsSchema {
    fields: SchemaField[];
}

interface WidgetSettingsModalProps {
    open: boolean;
    widget: Widget;
    catalog: AvailableWidget;
    dashboardSlug: string;
    onClose: () => void;
}

/**
 * Schema-driven settings modal for a single widget instance.
 *
 * Reads the widget's `settings_schema` off the available-widgets catalog,
 * seeds form state from the current instance options (falling back to each
 * field's `default`), and PATCHes the merged result to the server on save.
 *
 * Field types in v1: text, number, select, toggle, multiselect. Unknown
 * types render a visible placeholder so authors can spot a typo without
 * the field silently disappearing.
 */
export function WidgetSettingsModal({
    open,
    widget,
    catalog,
    dashboardSlug,
    onClose,
}: WidgetSettingsModalProps) {
    const rawSchema = useMemo(() => extractSchema(catalog), [catalog]);

    // Run the extracted schema's field list through
    // `.dashboard.widget.settings.fields` so a plugin can add / remove /
    // reorder fields the server-declared schema doesn't cover (e.g. a
    // plugin-added "background image" field for a widget it extends).
    // The filter operates on the field list rather than the whole
    // schema so callers don't need to reconstruct the wrapping shape.
    // Args: `(SchemaField[], { widget, catalog })`. Returning an empty
    // list unmounts the modal — matches the "no editable settings" path.
    const schema = useMemo(() => {
        if (!rawSchema) {
            return null;
        }
        const fields = applyFilters<SchemaField[]>(
            'keystone.admin.dashboard.widget.settings.fields',
            rawSchema.fields,
            { widget, catalog },
        );
        return { fields };
    }, [rawSchema, widget, catalog]);

    const initialValues = useMemo(
        () => seedValues(schema, widget.options),
        [schema, widget.options],
    );

    const [values, setValues] = useState<WidgetOptions>(initialValues);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const dialogRef = useFocusTrap<HTMLDivElement>(open);

    // Reset form state when the modal re-opens (or swaps to a different widget)
    // using the "store previous prop" pattern instead of `useEffect` so the
    // reset lands during render — an effect would briefly flash stale values
    // before settling, which is visible on a fast Edit→Edit-different click.
    const seedSignatureRef = useRef<string | null>(null);
    const seedSignature = open ? widget.id : null;
    if (seedSignatureRef.current !== seedSignature) {
        seedSignatureRef.current = seedSignature;
        if (seedSignature !== null) {
            setValues(initialValues);
            setErrors({});
        }
    }

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!schema || schema.fields.length === 0) {
        return null;
    }

    function handleChange(name: string, value: unknown) {
        setValues((current) => ({ ...current, [name]: value }));
        if (errors[name]) {
            setErrors((current) => {
                const next = { ...current };
                delete next[name];
                return next;
            });
        }
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) {
            return;
        }

        setSaving(true);
        router.patch(
            updateWidget({ slug: dashboardSlug, id: widget.id }).url,
            { options: values } as never,
            {
                preserveScroll: true,
                preserveState: true,
                only: ['current', 'available_widgets'],
                onSuccess: () => {
                    setErrors({});
                    onClose();
                },
                onError: (responseErrors) => {
                    setErrors(normalizeErrors(responseErrors));
                },
                onFinish: () => setSaving(false),
            },
        );
    }

    return (
        <div
            className={`pointer-events-none fixed inset-0 z-50 ${open ? '' : 'invisible'}`}
            aria-hidden={!open}
        >
            <button
                type="button"
                aria-label="Close widget settings"
                className={`pointer-events-auto absolute inset-0 bg-black/40 transition-opacity ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
            />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="widget-settings-modal-heading"
                tabIndex={-1}
                className={`pointer-events-auto absolute left-1/2 top-1/2 flex w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-base-300/60 bg-base-100 shadow-2xl transition-opacity duration-150 focus:outline-none ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
            >
                <header className="flex items-start justify-between gap-4 border-b border-base-300/60 px-5 py-4">
                    <div className="flex flex-col gap-1">
                        <h2
                            id="widget-settings-modal-heading"
                            className="font-display text-base font-semibold text-base-content"
                        >
                            {widget.title} settings
                        </h2>
                        <p className="text-xs text-base-content/65">
                            Configure how this widget behaves on your dashboard.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close widget settings"
                        className="rounded-md p-1 text-base-content/55 hover:bg-base-200/60 hover:text-base-content"
                        onClick={onClose}
                    >
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
                            <path
                                d="M6 6l12 12M18 6 6 18"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="flex flex-col">
                    <div className="flex flex-col gap-4 px-5 py-5">
                        {schema.fields.map((field: SchemaField) => (
                            <FieldRow
                                key={field.name}
                                field={field}
                                value={values[field.name]}
                                error={errors[field.name]}
                                onChange={(value) => handleChange(field.name, value)}
                            />
                        ))}
                    </div>

                    {errors.__form__ && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="mx-5 mb-3 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error"
                        >
                            {errors.__form__}
                        </div>
                    )}

                    <footer className="flex items-center justify-end gap-2 border-t border-base-300/60 px-5 py-3">
                        <button
                            type="button"
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/70 hover:bg-base-200/60"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-50"
                            disabled={saving}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}

interface FieldRowProps {
    field: SchemaField;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
}

function FieldRow({ field, value, error, onChange }: FieldRowProps) {
    const id = `widget-settings-field-${field.name}`;

    // Multiselect renders a group of checkboxes inside a <div>, so a
    // `<label htmlFor>` binding would point at a non-form element. Use the
    // <fieldset>/<legend> grouping idiom instead so assistive tech reads
    // the field label as the group caption.
    if (field.type === 'multiselect') {
        return (
            <fieldset className="flex flex-col gap-1.5">
                <legend className="text-xs font-semibold text-base-content/70">
                    {field.label}
                </legend>
                <FieldControl id={id} field={field} value={value} onChange={onChange} />
                {field.description && (
                    <p className="text-[11px] text-base-content/55">{field.description}</p>
                )}
                {error && <p className="text-[11px] text-error">{error}</p>}
            </fieldset>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-semibold text-base-content/70">
                {field.label}
            </label>
            <FieldControl id={id} field={field} value={value} onChange={onChange} />
            {field.description && (
                <p className="text-[11px] text-base-content/55">{field.description}</p>
            )}
            {error && <p className="text-[11px] text-error">{error}</p>}
        </div>
    );
}

interface FieldControlProps {
    id: string;
    field: SchemaField;
    value: unknown;
    onChange: (value: unknown) => void;
}

function FieldControl({ id, field, value, onChange }: FieldControlProps) {
    switch (field.type) {
        case 'text':
            return <TextField id={id} field={field} value={value} onChange={onChange} />;
        case 'number':
            return <NumberField id={id} field={field} value={value} onChange={onChange} />;
        case 'select':
            return <SelectField id={id} field={field} value={value} onChange={onChange} />;
        case 'toggle':
            return <ToggleField id={id} field={field} value={value} onChange={onChange} />;
        case 'multiselect':
            return <MultiSelectField id={id} field={field} value={value} onChange={onChange} />;
        default:
            return (
                <p
                    id={id}
                    className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1.5 text-[11px] text-warning"
                >
                    Unsupported field type: {String(field.type)}
                </p>
            );
    }
}

export function TextField({ id, value, onChange }: FieldControlProps) {
    return (
        <input
            id={id}
            type="text"
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/45 focus:border-primary focus:outline-none"
        />
    );
}

export function NumberField({ id, field, value, onChange }: FieldControlProps) {
    const raw = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
    return (
        <input
            id={id}
            type="number"
            value={raw}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            onChange={(event) => {
                const next = event.target.value;
                if (next === '') {
                    onChange('');
                    return;
                }
                const parsed = Number(next);
                onChange(Number.isNaN(parsed) ? next : parsed);
            }}
            className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/45 focus:border-primary focus:outline-none"
        />
    );
}

export function SelectField({ id, field, value, onChange }: FieldControlProps) {
    const options = field.options ?? [];
    const current = typeof value === 'string' || typeof value === 'number' ? String(value) : '';

    return (
        <select
            id={id}
            value={current}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm text-base-content focus:border-primary focus:outline-none"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

export function ToggleField({ id, value, onChange }: FieldControlProps) {
    const checked = Boolean(value);
    return (
        <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-base-content">
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="h-4 w-4 rounded border-base-300/60 text-primary focus:ring-primary"
            />
            <span className="text-xs text-base-content/70">{checked ? 'On' : 'Off'}</span>
        </label>
    );
}

export function MultiSelectField({ id, field, value, onChange }: FieldControlProps) {
    const options = field.options ?? [];
    const selected = Array.isArray(value) ? value.map(String) : [];

    function toggle(optionValue: string) {
        if (selected.includes(optionValue)) {
            onChange(selected.filter((entry) => entry !== optionValue));
        } else {
            onChange([...selected, optionValue]);
        }
    }

    return (
        <div id={id} className="flex flex-col gap-1">
            {options.map((option) => {
                const optionId = `${id}-${option.value}`;
                return (
                    <label
                        key={option.value}
                        htmlFor={optionId}
                        className="inline-flex items-center gap-2 text-sm text-base-content"
                    >
                        <input
                            id={optionId}
                            type="checkbox"
                            checked={selected.includes(option.value)}
                            onChange={() => toggle(option.value)}
                            className="h-4 w-4 rounded border-base-300/60 text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-base-content/70">{option.label}</span>
                    </label>
                );
            })}
        </div>
    );
}

/**
 * Pull and shape the widget's `settings_schema` from the available-widgets
 * catalog. Returns `null` when the catalog entry has no schema or its
 * `fields` are missing — the Dashboard page treats `null` as "no editable
 * settings" and hides the gear icon.
 */
export function extractSchema(catalog: AvailableWidget): SettingsSchema | null {
    const schema = catalog.settings_schema;
    if (!schema || typeof schema !== 'object') {
        return null;
    }

    const fields = (schema as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) {
        return null;
    }

    const normalized: SchemaField[] = [];

    for (const entry of fields) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const candidate = entry as Record<string, unknown>;
        if (typeof candidate.name !== 'string' || typeof candidate.type !== 'string') {
            continue;
        }
        normalized.push({
            name: candidate.name,
            label: typeof candidate.label === 'string' ? candidate.label : candidate.name,
            type: candidate.type,
            default: candidate.default,
            description: typeof candidate.description === 'string' ? candidate.description : undefined,
            min: typeof candidate.min === 'number' ? candidate.min : undefined,
            max: typeof candidate.max === 'number' ? candidate.max : undefined,
            step: typeof candidate.step === 'number' ? candidate.step : undefined,
            options: extractOptions(candidate.options),
        });
    }

    if (normalized.length === 0) {
        return null;
    }

    return { fields: normalized };
}

function extractOptions(raw: unknown): SelectOption[] | undefined {
    if (!Array.isArray(raw)) {
        return undefined;
    }

    const options: SelectOption[] = [];

    for (const entry of raw) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }
        const candidate = entry as Record<string, unknown>;
        const value = candidate.value;
        const label = candidate.label;
        if ((typeof value !== 'string' && typeof value !== 'number') || typeof label !== 'string') {
            continue;
        }
        options.push({ value: String(value), label });
    }

    return options;
}

function seedValues(schema: SettingsSchema | null, options: WidgetOptions): WidgetOptions {
    if (!schema) {
        return {};
    }

    const next: WidgetOptions = {};
    for (const field of schema.fields) {
        if (Object.prototype.hasOwnProperty.call(options, field.name)) {
            next[field.name] = options[field.name];
            continue;
        }
        if (field.default !== undefined) {
            next[field.name] = field.default;
        }
    }
    return next;
}

function normalizeErrors(responseErrors: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, message] of Object.entries(responseErrors)) {
        if (key === 'options') {
            normalized.__form__ = message;
            continue;
        }
        // Inertia surfaces the validation key as "options.<name>"; strip the
        // prefix so the FieldRow can look up the error by bare field name.
        const stripped = key.startsWith('options.') ? key.slice('options.'.length) : key;
        normalized[stripped] = message;
    }
    return normalized;
}

/**
 * Exposed so callers (`DashboardGrid`) can decide whether to render the
 * widget's Edit gear without having to instantiate the modal first.
 */
export function widgetHasSettings(catalog: AvailableWidget | undefined): boolean {
    if (!catalog) {
        return false;
    }
    return extractSchema(catalog) !== null;
}
