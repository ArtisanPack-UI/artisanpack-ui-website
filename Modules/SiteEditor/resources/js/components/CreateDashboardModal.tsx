import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { useFocusTrap } from '@/lib/admin/useFocusTrap';
import { store as storeDashboard } from '@/routes/admin/dashboards';

interface CreateDashboardModalProps {
    open: boolean;
    onClose: () => void;
}

/**
 * Modal that creates a new (empty) dashboard. On success the server redirects
 * to the new dashboard's show page, which renders the starter picker for the
 * empty state — keeping the create flow consistent with first-login.
 */
export function CreateDashboardModal({ open, onClose }: CreateDashboardModalProps) {
    const [name, setName] = useState('');
    const [makeDefault, setMakeDefault] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [wasOpen, setWasOpen] = useState(open);
    // Matches WidgetSettingsModal: `aria-modal="true"` promises focus stays
    // inside, and without a trap Tab walks straight out to the page behind.
    const dialogRef = useFocusTrap<HTMLDivElement>(open);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset form state on the closed→open transition. Doing this during
    // render (via the "store previous prop" pattern) rather than in an
    // effect avoids a cascading render that would briefly show the old
    // values before the reset commits.
    if (open && !wasOpen) {
        setWasOpen(true);
        setName('');
        setMakeDefault(false);
        setError(null);
        // Clearing `saving` too matters when the user closed mid-flight and
        // reopens before the request finishes — otherwise the form would
        // re-open already disabled with a stale "Creating…" label.
        setSaving(false);
    } else if (!open && wasOpen) {
        setWasOpen(false);
    }

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
            setError('Give your dashboard a name.');
            return;
        }

        setSaving(true);
        setError(null);

        router.post(
            storeDashboard().url,
            { name: trimmed, is_default: makeDefault },
            {
                preserveScroll: false,
                onError: (errors) => {
                    const firstKey = Object.keys(errors)[0];
                    if (!firstKey) {
                        setError('Could not create dashboard.');
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
                aria-label="Close create dashboard"
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
                tabIndex={-1}
                aria-labelledby="create-dashboard-modal-heading"
                className={`pointer-events-auto absolute left-1/2 top-1/2 flex w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-base-300/60 bg-base-100 shadow-2xl transition-opacity duration-150 ${
                    open ? 'opacity-100' : 'opacity-0'
                }`}
            >
                <header className="border-b border-base-300/60 px-5 py-4">
                    <h2
                        id="create-dashboard-modal-heading"
                        className="font-display text-base font-semibold text-base-content"
                    >
                        New dashboard
                    </h2>
                    <p className="mt-1 text-xs text-base-content/65">
                        Create another dashboard to organize a different view of your site.
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
                            placeholder="e.g. Reports, Marketing, Editorial"
                            maxLength={120}
                            className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm text-base-content placeholder:text-base-content/45 focus:border-primary focus:outline-none"
                        />
                    </label>

                    <label className="flex items-center gap-2 text-sm text-base-content/85">
                        <input
                            type="checkbox"
                            checked={makeDefault}
                            onChange={(event) => setMakeDefault(event.target.checked)}
                            className="h-4 w-4 rounded border-base-300/60"
                        />
                        Set as default
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
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-content hover:bg-primary-hover disabled:opacity-60"
                        >
                            {saving ? 'Creating…' : 'Create dashboard'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
