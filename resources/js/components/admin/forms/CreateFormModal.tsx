import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import forms from '@/routes/admin/forms';

interface CreateFormModalProps {
    open: boolean;
    onClose: () => void;
}

/**
 * Modal that creates a new form. Asks for the name only; the slug is
 * derived server-side by the forms package's `Form::creating` hook so
 * the user doesn't have to keep two coupled fields in sync at create
 * time. On success the server redirects to the form's edit page.
 */
export function CreateFormModal({ open, onClose }: CreateFormModalProps) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Tracks the previous `open` value so the reset logic only fires on
    // the closed→open transition. A ref instead of state keeps the
    // reset out of render — calling setState inside the render body
    // (the previous shape) violates React's render purity contract and
    // can spuriously trigger StrictMode double-invocation.
    const wasOpenRef = useRef(open);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            setName('');
            setError(null);
            setSaving(false);
        }

        wasOpenRef.current = open;
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', handleKey);
        const focusId = window.setTimeout(() => inputRef.current?.focus(), 0);

        return () => {
            document.removeEventListener('keydown', handleKey);
            window.clearTimeout(focusId);
        };
    }, [open, onClose]);

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving) {
            return;
        }

        const trimmed = name.trim();

        if ('' === trimmed) {
            setError('Give your form a name.');
            return;
        }

        setSaving(true);
        setError(null);

        router.post(
            forms.create().url,
            { name: trimmed },
            {
                preserveScroll: false,
                onError: (errors) => {
                    const firstKey = Object.keys(errors)[0];
                    if (!firstKey) {
                        setError('Could not create form.');
                        return;
                    }
                    const err = errors[firstKey];
                    setError(Array.isArray(err) ? String(err[0]) : String(err));
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
                aria-label="Close create form"
                className={`pointer-events-auto absolute inset-0 bg-black/40 transition-opacity ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-form-modal-heading"
                className={`pointer-events-auto absolute left-1/2 top-1/2 flex w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-base-300/60 bg-base-100 shadow-2xl transition-opacity duration-150 ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
            >
                <header className="border-b border-base-300/60 px-5 py-4">
                    <h2
                        id="create-form-modal-heading"
                        className="font-display text-base font-semibold text-base-content"
                    >
                        New form
                    </h2>
                    <p className="mt-1 text-xs text-base-content/65">
                        Name your form — we&apos;ll generate a URL-friendly slug from it. You can
                        change either later from the form builder.
                    </p>
                </header>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
                    <label className="flex flex-col gap-1.5 text-sm">
                        <span className="font-medium text-base-content">Name</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="e.g. Contact Us, Quote Request"
                            maxLength={255}
                            className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/45 focus:border-primary focus:outline-none"
                        />
                    </label>

                    {error && (
                        <p role="alert" className="text-xs text-error">
                            {error}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200/60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary/90 disabled:opacity-60"
                        >
                            {saving ? 'Creating…' : 'Create form'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
