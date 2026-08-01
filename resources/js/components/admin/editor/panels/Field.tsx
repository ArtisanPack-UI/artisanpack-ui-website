import { useId, type ReactNode } from 'react';

/**
 * Attributes the field computes and the control must carry so the label,
 * hint, and error are programmatically associated with it.
 */
export interface FieldControlProps {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
}

interface FieldProps {
    label: string;
    error?: string;
    hint?: string;
    /**
     * Render the control, spreading the props it is handed.
     *
     * A render function rather than a plain node (#193): the field owns the
     * generated ids, and there is no way to attach them to an opaque
     * `ReactNode` without `cloneElement` guesswork. Wrapping the control in
     * a `<label>` instead would fold the hint and the error text into its
     * accessible name, which is how the association used to be implied here
     * — a screen reader read "Menu order Lower numbers sort first" as the
     * name of the input.
     */
    input: (props: FieldControlProps) => ReactNode;
}

export default function Field({ label, error, hint, input }: FieldProps) {
    const id = useId();
    const hintId = useId();
    const errorId = useId();
    const showHint = hint !== undefined && error === undefined;

    return (
        <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor={id} className="font-semibold text-base-content/85">
                {label}
            </label>
            {input({
                id,
                'aria-invalid': error !== undefined ? true : undefined,
                'aria-describedby': error !== undefined ? errorId : showHint ? hintId : undefined,
            })}
            {showHint && (
                <span id={hintId} className="text-xs text-base-content/70">
                    {hint}
                </span>
            )}
            {/*
             * `role="alert"` so a validation message that appears after a
             * failed save is spoken where it lands, rather than only being
             * found by a user who happens to Tab back onto the field (#193).
             */}
            {error !== undefined && (
                <span id={errorId} role="alert" className="text-xs text-error">
                    {error}
                </span>
            )}
        </div>
    );
}
