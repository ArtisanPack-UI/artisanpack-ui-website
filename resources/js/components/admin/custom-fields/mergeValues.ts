import type { FormDataConvertible } from '@inertiajs/core';
import type { CustomFieldRecord } from './types';

/**
 * Merge in the server-shipped custom-field values as a baseline so an
 * untouched field posts its current value rather than dropping to
 * `undefined` — the update handler treats a missing key as "leave
 * alone" only for optional fields, and a boolean toggled true then
 * back to false would otherwise round-trip as unset.
 *
 * Values run through {@link coerceForFormData} so plugin-supplied
 * types (e.g. a nested object from an image picker) still round-trip
 * through Inertia's `FormDataConvertible` contract instead of blowing
 * up at post-time on a non-serializable value.
 */
export function mergeCustomFieldValues(
    fields: CustomFieldRecord[],
    dirty: Record<string, unknown>,
): Record<string, FormDataConvertible> {
    const merged: Record<string, FormDataConvertible> = {};
    for (const field of fields) {
        const raw = Object.prototype.hasOwnProperty.call(dirty, field.key)
            ? dirty[field.key]
            : field.value;
        merged[field.key] = coerceForFormData(raw);
    }
    return merged;
}

function coerceForFormData(value: unknown): FormDataConvertible {
    if (value === null || value === undefined) return null;
    if (
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        typeof value === 'string'
    ) {
        return value;
    }
    // File / Blob are legitimate FormDataConvertible values — Inertia
    // detects them and switches the request to `multipart/form-data`.
    // Guard BEFORE the plain-object branch because a Blob has no
    // enumerable own entries and would otherwise collapse to `{}`,
    // silently dropping the upload payload.
    if (
        (typeof Blob !== 'undefined' && value instanceof Blob) ||
        (typeof File !== 'undefined' && value instanceof File) ||
        value instanceof Date
    ) {
        return value as FormDataConvertible;
    }
    if (Array.isArray(value)) {
        return value.map(coerceForFormData);
    }
    if (typeof value === 'object') {
        const out: Record<string, FormDataConvertible> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = coerceForFormData(v);
        }
        return out;
    }
    return String(value);
}
