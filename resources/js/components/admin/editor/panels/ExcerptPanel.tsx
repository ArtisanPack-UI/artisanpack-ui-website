import { useId } from 'react';
import CollapsibleCard from '@/components/admin/CollapsibleCard';

interface ExcerptPanelProps {
    value: string;
    error?: string;
    onChange: (next: string) => void;
}

function truncate(value: string, limit: number): string {
    if (value.length <= limit) return value;
    return value.slice(0, limit - 1) + '…';
}

export default function ExcerptPanel({ value, error, onChange }: ExcerptPanelProps) {
    const summary = value.trim() === '' ? 'No excerpt' : truncate(value.trim(), 48);
    const errorId = useId();
    const hintId = useId();
    return (
        <CollapsibleCard title="Excerpt" summary={summary} defaultOpen>
            <div className="flex flex-col gap-1.5 text-sm">
                <textarea
                    rows={4}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label="Excerpt"
                    aria-invalid={error ? true : undefined}
                    // The hint below was rendered but never associated, so
                    // it existed for sighted users only — and it was also
                    // duplicated verbatim as the placeholder, which a
                    // screen reader may read as the field's name. Point at
                    // the real hint and drop the placeholder.
                    aria-describedby={error ? errorId : hintId}
                    className="w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                {!error && (
                    <span id={hintId} className="text-xs text-base-content/70">
                        Short summary shown in listings and meta tags.
                    </span>
                )}
                {error && (
                    <span id={errorId} role="alert" className="text-xs text-error">
                        {error}
                    </span>
                )}
            </div>
        </CollapsibleCard>
    );
}
