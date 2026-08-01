import { useState } from 'react';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import Field from './Field';

export interface ParentOption {
    value: number;
    label: string;
}

interface AttributesPanelProps {
    parentId: number | null;
    template: string;
    order: number;
    parentOptions: ParentOption[];
    showParentAndOrder: boolean;
    showTemplate: boolean;
    parentError?: string;
    templateError?: string;
    orderError?: string;
    onParentChange: (value: number | null) => void;
    onTemplateChange: (value: string) => void;
    onOrderChange: (value: number) => void;
}

export default function AttributesPanel({
    parentId,
    template,
    order,
    parentOptions,
    showParentAndOrder,
    showTemplate,
    parentError,
    templateError,
    orderError,
    onParentChange,
    onTemplateChange,
    onOrderChange,
}: AttributesPanelProps) {
    // The menu-order input holds its own raw text.
    //
    // Bound directly to `order`, the field could not be cleared: deleting
    // the content fired `onChange` with `''`, the handler kept the previous
    // number rather than committing a 0, and React immediately re-rendered
    // that number back into the box. The next digit typed then concatenated
    // onto the restored value ("5" → clear → type "2" → "52"). Keeping the
    // text local lets the field be empty while the committed order stays
    // put, which is what "don't ship a silent 0" actually requires.
    const [orderDraft, setOrderDraft] = useState(() => String(order));
    const [committedOrder, setCommittedOrder] = useState(order);

    // Adopt an order that changed from outside (fresh page props after a
    // save) without clobbering in-progress typing. React's documented
    // "adjusting state when a prop changes" pattern rather than an effect:
    // an effect would paint the stale value for a frame first, and the
    // `react-hooks/set-state-in-effect` rule rejects it outright.
    //
    // Comparing against the last *committed* order — not the draft — is
    // what keeps a cleared field empty: clearing never changes `order`, so
    // this branch doesn't run and refill it underneath the user.
    if (order !== committedOrder) {
        setCommittedOrder(order);
        setOrderDraft(String(order));
    }

    if (!showParentAndOrder && !showTemplate) {
        return null;
    }

    const parentLabel = parentOptions.find((p) => p.value === parentId)?.label ?? 'No parent';
    const summary = [
        showParentAndOrder ? parentLabel : null,
        showTemplate ? template || 'default template' : null,
        showParentAndOrder ? `order ${order}` : null,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <CollapsibleCard title="Attributes" summary={summary}>
            <div className="flex flex-col gap-4">
                {showParentAndOrder && (
                    <Field
                        label="Parent page"
                        hint="Choose a parent to nest this page in the hierarchy."
                        error={parentError}
                        input={(field) => (
                            <select
                                {...field}
                                value={parentId ?? ''}
                                onChange={(e) =>
                                    onParentChange(e.target.value ? Number(e.target.value) : null)
                                }
                                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                                <option value="">— No parent —</option>
                                {parentOptions.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    />
                )}
                {showTemplate && (
                    <Field
                        label="Template"
                        hint="Theme template slug to render this page with."
                        error={templateError}
                        input={(field) => (
                            <input
                                {...field}
                                type="text"
                                value={template}
                                onChange={(e) => onTemplateChange(e.target.value)}
                                placeholder="default"
                                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 font-mono text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                            />
                        )}
                    />
                )}
                {showParentAndOrder && (
                    <Field
                        label="Menu order"
                        hint="Lower numbers sort first."
                        error={orderError}
                        input={(field) => (
                            <input
                                {...field}
                                type="number"
                                min={0}
                                value={orderDraft}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setOrderDraft(raw);

                                    // Commit only what the field actually
                                    // promises. `Number('')` is 0 and
                                    // `Number('abc')` is NaN — both would
                                    // silently ship a wrong value in the PUT
                                    // payload — and a typed `-5` satisfies
                                    // `Number.isFinite` even though `min={0}`
                                    // says otherwise (the attribute only
                                    // constrains the spinner, not typing).
                                    // Anything else leaves the last committed
                                    // order in place.
                                    const parsed = Number(raw);
                                    if (raw !== '' && Number.isFinite(parsed) && parsed >= 0) {
                                        onOrderChange(parsed);
                                    }
                                }}
                                onBlur={() => {
                                    // Leaving the field empty or invalid snaps
                                    // the text back to what is committed, so
                                    // what the user sees and what will be
                                    // saved can never disagree.
                                    setOrderDraft(String(order));
                                }}
                                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                            />
                        )}
                    />
                )}
            </div>
        </CollapsibleCard>
    );
}
