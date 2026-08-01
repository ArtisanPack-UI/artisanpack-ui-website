import type { ReactNode } from 'react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import type { CustomFieldRecord } from './types';

/**
 * The "Custom Fields" card mounted on the post / page edit screens.
 * Renders one editor per registered field, wired to a
 * `custom_fields` state slice on the parent form.
 *
 * Returns `null` when no fields exist so the card doesn't clutter the
 * edit screen for content types that have never had a field registered.
 */
export default function CustomFieldsSection({
    fields,
    values,
    errors,
    onChange,
}: {
    fields: CustomFieldRecord[];
    values: Record<string, unknown>;
    errors: Record<string, string>;
    onChange: (key: string, value: unknown) => void;
}) {
    if (fields.length === 0) {
        return null;
    }

    const section: ReactNode = (
        <CollapsibleCard
            title="Custom Fields"
            summary={`${fields.length} field${fields.length === 1 ? '' : 's'}`}
            defaultOpen
        >
            <div className="grid gap-5 md:grid-cols-2">
                {fields.map((field) => (
                    <CustomFieldRenderer
                        key={field.key}
                        field={field}
                        value={valueFor(field, values)}
                        error={errors[`custom_fields.${field.key}`]}
                        onChange={(next) => onChange(field.key, next)}
                    />
                ))}
            </div>
        </CollapsibleCard>
    );

    // `keystone.admin.customFields.section` — wraps the entire Custom
    // Fields card so plugins can inject headers/footers, swap the
    // container, or gate the whole surface behind a feature flag. Args:
    // `(ReactNode, { fields, values, errors })`. Return `null` to
    // suppress the section entirely.
    return applyFilters<ReactNode>(
        'keystone.admin.customFields.section',
        section,
        { fields, values, errors },
    );
}

/**
 * Pick the current value for a field, falling back to the server-shipped
 * hydration in {@link CustomFieldRecord.value} on first render (before the
 * user has touched anything) and then to the field's declared default.
 */
function valueFor(field: CustomFieldRecord, values: Record<string, unknown>): unknown {
    if (Object.prototype.hasOwnProperty.call(values, field.key)) {
        return values[field.key];
    }
    if (field.value !== null && field.value !== undefined) {
        return field.value;
    }
    return field.default_value;
}
