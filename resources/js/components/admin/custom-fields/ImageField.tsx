import type { CustomFieldEditorProps } from './types';
import { FieldShell } from './FieldShell';

/**
 * Captures an image URL / identifier the same way {@link FileField}
 * does. The featured-image picker on the main edit screen already
 * covers the full media-library workflow — this custom-field variant
 * stays minimal so plugin authors can plug in a richer picker via the
 * field-type registry's `editor_component` slot later.
 */
export default function ImageField({ field, value, error, onChange }: CustomFieldEditorProps) {
    const stringValue = value === null || value === undefined ? '' : String(value);

    return (
        <FieldShell field={field} error={error}>
            <input
                type="url"
                value={stringValue}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
            />
            {stringValue && (
                <img
                    // Key by URL so a corrected URL re-mounts the img
                    // element — otherwise the imperative `display: none`
                    // from a prior failed onError sticks and hides the
                    // preview even after the user fixes the value.
                    key={stringValue}
                    src={stringValue}
                    alt=""
                    className="mt-2 max-h-32 w-auto rounded-md border border-base-300/60 bg-base-200"
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                />
            )}
        </FieldShell>
    );
}
