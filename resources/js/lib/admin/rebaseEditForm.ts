/**
 * Post-save rebase for the content edit screens (`posts`, `pages`).
 *
 * The record that comes back on the post-save redirect is the only
 * trustworthy account of what was persisted. The server owns several
 * fields outright — a colliding slug comes back adjusted, publishing
 * "Immediately" gets a stamped `published_at`, a future date on
 * Published comes back as Scheduled — and, on top of that, a plugin on
 * `keystone.admin.edit.form.beforeSubmit` (or its resource-scoped
 * variant) may have rewritten *any* field on the way out.
 *
 * Rebasing only the server-owned trio from the response and everything
 * else from the submitted snapshot is what caused #232: for a filtered
 * field the screen kept showing the pre-filter value and marked it
 * clean, so no dirty indicator prompted a reload and the next save
 * wrote the stale value back over the filtered one.
 */

/** Every edit form carries a `custom_fields` overlay — see {@link rebaseCustomFields}. */
type EditForm = { custom_fields: Record<string, unknown> };

/**
 * Merge the saved record back into the live form state.
 *
 * A field is only adopted where the user hasn't touched it since the
 * request left. Comparing against `submitted` — the request-start
 * snapshot — rather than against the saved record is what keeps an edit
 * made while the save was in flight from vanishing silently, because
 * the baseline would match the adopted value too.
 *
 * @param current   Form state at the moment the response landed.
 * @param submitted Snapshot of the form as it was when the request left.
 * @param saved     The persisted record, in form shape.
 */
export function rebaseEditForm<TForm extends EditForm>(
    current: TForm,
    submitted: TForm,
    saved: Partial<Omit<TForm, 'custom_fields'>>,
): TForm {
    const currentValues = current as Record<string, unknown>;
    const submittedValues = submitted as Record<string, unknown>;
    const next: Record<string, unknown> = { ...currentValues };

    for (const [key, savedValue] of Object.entries(saved)) {
        if (isUnchangedSince(currentValues[key], submittedValues[key])) {
            next[key] = savedValue;
        }
    }

    next.custom_fields = rebaseCustomFields(current.custom_fields, submitted.custom_fields);

    return next as TForm;
}

/**
 * The baseline the dirty check compares against: what the server says
 * it now holds, with the submitted snapshot covering any field the
 * response doesn't hydrate back.
 */
export function rebaseEditBaseline<TForm extends EditForm>(
    submitted: TForm,
    saved: Partial<Omit<TForm, 'custom_fields'>>,
): TForm {
    return { ...submitted, ...saved, custom_fields: {} } as TForm;
}

/**
 * The `custom_fields` slice is an overlay of locally edited keys only —
 * the persisted values ride along on the `customFields` prop, which the
 * redirect re-hydrates. So the rebase drops every key the request
 * carried (the section then reads the fresh, possibly filtered, server
 * value) and keeps only the keys the user changed while the save was in
 * flight, which is the same in-flight guard the flat fields get.
 */
function rebaseCustomFields(
    current: Record<string, unknown>,
    submitted: Record<string, unknown>,
): Record<string, unknown> {
    const kept: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(current)) {
        const wasSubmitted = Object.prototype.hasOwnProperty.call(submitted, key);
        if (wasSubmitted && isUnchangedSince(value, submitted[key])) {
            continue;
        }
        kept[key] = value;
    }

    return kept;
}

/**
 * Whether the live value is still the one that was submitted. Values
 * here are plain JSON (`seo` and `featured_image` are objects), so this
 * matches the structural comparison the screens' `isDirty` already uses
 * — deliberately, because a comparator that disagreed with the dirty
 * check would let the two land on different answers for the same pair.
 *
 * That shared comparison is `JSON.stringify`, so it is key-order
 * sensitive. Safe today: the only compared operands (`current` and
 * `submitted`) descend from one object identity, and the panels that
 * rebuild them spread the previous value rather than re-literal it. A
 * panel that ever rebuilds a sub-form key-by-key would have to fix
 * `isDirty` alongside this.
 */
function isUnchangedSince(current: unknown, submitted: unknown): boolean {
    return current === submitted || JSON.stringify(current) === JSON.stringify(submitted);
}
