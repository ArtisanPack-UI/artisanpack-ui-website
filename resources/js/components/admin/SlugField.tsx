import { useEffect, useId, useRef, useState } from 'react';

/**
 * Slug field with the three-state lifecycle from #185:
 *
 * - **Draft, never manually edited:** slug auto-derives from the title live
 *   (debounced ~500ms). The user can still type in the slug field — the
 *   first manual edit switches auto-derive off for the rest of this
 *   session; a "Regenerate from title" button turns it back on.
 * - **First publish:** the caller flips `autoDeriveAllowed` to `false` so
 *   the field stops tracking the title, but stays manually editable.
 * - **Unpublish → draft:** stays frozen. The caller keeps
 *   `autoDeriveAllowed` at `false` because the URL was public once.
 *
 * Collision handling comes from the preview endpoint — the server returns
 * `{ slug, auto_adjusted }` and this component renders the
 * `(auto-adjusted)` hint next to the permalink when the counter fires.
 *
 * The component reports slug + touched state up. It never owns the form
 * value — the parent's `slug` prop is the source of truth on the wire.
 */
export interface SlugFieldProps {
    /** Live title from the outer form; drives auto-derive. */
    title: string;
    /** Current slug value on the outer form. */
    slug: string;
    /**
     * `true` while auto-derive is a legal state for this record —
     * typically `status === 'draft' && !hasEverBeenPublished`. The
     * component still honors its own "user manually edited" flag on top
     * of this: once the user types in the slug field, auto-derive
     * pauses even when this stays `true`, until they click Regenerate.
     */
    autoDeriveAllowed: boolean;
    /** Slug preview endpoint (POST). Returns `{ slug, auto_adjusted }`. */
    previewUrl: string;
    /** Existing record ID to ignore in the uniqueness check, or `null` on Create. */
    ignoreId: number | null;
    /**
     * Absolute permalink template with `{slug}` where the slug segment
     * belongs (e.g. `https://site.test/blog/{slug}` for posts, or
     * `https://site.test/{slug}` for pages). Rendered below the field.
     */
    permalinkTemplate: string;
    /** Server-side validation error to render inline. */
    error?: string;
    /** Emit the next slug value up to the outer form. */
    onSlugChange: (slug: string) => void;
}

/**
 * Rough client-side equivalent of Laravel's `Str::slug()`. Deliberately
 * simple — it exists only to answer "does this saved slug look like it was
 * derived from this title, or did somebody type it?", never to produce a
 * slug we'd actually submit (the preview endpoint owns that).
 */
function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Whether `slug` differs from what the title would have produced — i.e.
 * somebody edited it by hand.
 *
 * The trailing `-<n>` is stripped before comparing so a slug the server
 * auto-adjusted for a collision (`my-post` → `my-post-2`) still reads as
 * auto-derived and keeps tracking the title.
 *
 * Errs toward "hand-edited": `slugify()` doesn't transliterate accents the
 * way `Str::slug()` does, so a title like "Café" can read as a mismatch.
 * That direction only ever *disables* auto-derive, which is the failure
 * mode that doesn't destroy the user's data.
 */
function looksHandEdited(slug: string, title: string): boolean {
    if (slug === '') return false;

    const derived = slugify(title);

    return slug !== derived && slug.replace(/-\d+$/, '') !== derived;
}

export default function SlugField({
    title,
    slug,
    autoDeriveAllowed,
    previewUrl,
    ignoreId,
    permalinkTemplate,
    error,
    onSlugChange,
}: SlugFieldProps) {
    // A manual edit disarms auto-derive. "Regenerate from title" is the
    // only way to re-arm it.
    //
    // Seeded from the incoming props rather than starting at `false`,
    // because this state has to survive a page load: a hand-edited slug
    // that was saved and then reopened would otherwise arrive disarmed
    // only in the previous session's memory, and the very next
    // auto-derive would overwrite it with the title-derived value.
    const [manualOverride, setManualOverride] = useState(() => looksHandEdited(slug, title));
    const [autoAdjusted, setAutoAdjusted] = useState(false);
    // Text for the live region below. Empty on mount so the announcement
    // is the text *arriving*, which is what assistive tech reports.
    const [announcement, setAnnouncement] = useState('');

    const slugId = useId();
    const permalinkId = useId();
    const errorId = useId();

    const isAutoDeriving = autoDeriveAllowed && !manualOverride;

    // AbortController for the in-flight preview request. If the user
    // types again mid-fetch, cancel the stale response so it can't
    // clobber a fresher slug.
    const abortRef = useRef<AbortController | null>(null);

    // The title the slug was last derived from. Seeded with the title we
    // mounted with, which is what makes auto-derive respond to title
    // *changes* rather than firing once on every page load — the latter
    // silently rewrote saved slugs (a freed-up collision could turn
    // `my-post-2` back into `my-post`) and dirtied the form with no user
    // input, tripping the unsaved-changes prompt on the way out.
    //
    // It also collapses the duplicate request "Regenerate from title"
    // used to make: that button fetches immediately, and re-arming
    // auto-derive re-ran this effect, which queued an identical fetch
    // 500ms later.
    const lastDerivedTitleRef = useRef(title);

    // Abort any pending fetch when the component unmounts (parent
    // navigates away, or the field is re-mounted after a status flip)
    // so a late-arriving response can't call `onSlugChange`/
    // `setAutoAdjusted` against a stale closure.
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    // Canonical closure-scoped debounce: the timer id is a LOCAL const
    // owned by this effect run, so the cleanup unconditionally cancels
    // *this specific* timer without needing a shared ref (which is
    // easy to leak/desync on rapid re-renders). Cleanup runs before the
    // next effect on every keystroke, so only one timer is ever
    // pending — no additive delay.
    useEffect(() => {
        if (!isAutoDeriving) return;
        if (title.trim() === '') return;
        if (title === lastDerivedTitleRef.current) return;

        const timer = setTimeout(() => {
            void requestPreview(title);
        }, 500);

        return () => {
            clearTimeout(timer);
        };
        // `requestPreview` closes over the current props via refs below,
        // so we only need to re-run on the inputs that change the debounced
        // preview target.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [title, isAutoDeriving, ignoreId, previewUrl]);

    async function requestPreview(sourceTitle: string): Promise<void> {
        // Claim the title synchronously, before the first `await`, so a
        // re-render triggered by the caller (Regenerate flipping
        // `manualOverride`) sees it and doesn't schedule a duplicate.
        lastDerivedTitleRef.current = sourceTitle;

        if (abortRef.current !== null) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(previewUrl, {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': decodeURIComponent(
                        document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '',
                    ),
                },
                body: JSON.stringify({
                    title: sourceTitle,
                    ignore_id: ignoreId ?? undefined,
                }),
            });
            if (!res.ok) return;
            const data = (await res.json()) as { slug: string; auto_adjusted: boolean };
            onSlugChange(data.slug);
            setAutoAdjusted(data.auto_adjusted);
            // The URL just changed underneath the author without them
            // touching this field. Sighted users see it happen; without
            // this the only announced case was a collision suffix, so a
            // screen-reader user could publish at a URL nobody told them
            // about. Debounced by construction — this only runs when a
            // preview request actually completes.
            setAnnouncement(`Slug updated to ${data.slug}`);
        } catch (err) {
            // AbortError is expected on rapid retyping — swallow it.
            if (err instanceof DOMException && err.name === 'AbortError') return;
            // Anything else: leave the current slug alone. The user
            // can still edit by hand and the server-side unique rule
            // catches collisions on save.
        }
    }

    function handleManualEdit(next: string) {
        // Cancel any preview still in flight. Without this, a response
        // that was already on the wire when the user started typing lands
        // afterwards and overwrites the slug they just entered by hand —
        // the exact edit that is supposed to disarm auto-derive.
        abortRef.current?.abort();
        abortRef.current = null;

        setManualOverride(true);
        setAutoAdjusted(false);
        onSlugChange(next);
    }

    function regenerate() {
        setManualOverride(false);
        setAutoAdjusted(false);
        // Fire immediately (no debounce) — the button is an explicit
        // user action, so instant feedback beats the 500ms delay.
        if (title.trim() !== '') {
            void requestPreview(title);
        }
    }

    // Defensive against a missing template — an older Inertia page-
    // prop payload (or a plugin that shadows the edit render) could
    // omit `permalink_template`; render nothing rather than throwing.
    const permalink = (permalinkTemplate ?? '').replace('{slug}', slug || '');

    return (
        /*
         * A `<div>` rather than a wrapping `<label>` (#193): the Regenerate
         * button sits in the same row as the label text, and a control
         * nested inside a `<label>` swallows clicks meant for it and is
         * invalid HTML besides. `htmlFor` gives the input the same
         * association the wrapper used to imply.
         */
        <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between">
                <label htmlFor={slugId} className="font-semibold text-base-content/85">
                    Slug
                </label>
                {autoDeriveAllowed && manualOverride ? (
                    <button
                        type="button"
                        onClick={regenerate}
                        // `inline-flex items-center max-lg:min-h-11`: an
                        // 11px text link is ~16px tall, under the 24px WCAG
                        // 2.5.8 floor with the slug input immediately
                        // below. The extra height joins the tap target
                        // rather than sitting beside it.
                        className="inline-flex items-center rounded-md text-[11px] font-semibold text-primary max-lg:min-h-11 hover:underline focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                    >
                        Regenerate from title
                    </button>
                ) : null}
            </div>
            <input
                id={slugId}
                // Stable hook for the browser suite: `id` is a generated
                // `useId()` value and the class list is styling, so neither
                // is safe to select on.
                data-slug-input
                type="text"
                value={slug}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${errorId} ${permalinkId}` : permalinkId}
                onChange={(e) => handleManualEdit(e.target.value)}
                className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 font-mono text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <div
                id={permalinkId}
                className="flex flex-wrap items-center gap-1.5 text-xs text-base-content/70"
            >
                <span className="truncate font-mono">{permalink}</span>
                {/*
                 * `role="status"` (an implicit `aria-live="polite"` region):
                 * the server silently appends `-2` to a colliding slug, and
                 * a purely visual hint means a screen-reader user publishes
                 * at a URL they were never told about. The region is always
                 * mounted so the text landing inside it is what triggers the
                 * announcement — mounting the region *with* its text is a
                 * change assistive tech routinely misses.
                 */}
                <span role="status">
                    <span className="sr-only">{announcement}</span>
                    {autoAdjusted && isAutoDeriving ? (
                        <span
                            className="rounded-full bg-warning/20 px-1.5 py-[1px] font-semibold text-base-content ring-1 ring-inset ring-warning/50"
                            title="A record with this slug already exists — a number was appended to keep the URL unique."
                        >
                            (auto-adjusted)
                            <span className="sr-only">
                                {' '}
                                — a record with this slug already exists, so a number was appended
                                to keep the URL unique.
                            </span>
                        </span>
                    ) : null}
                </span>
            </div>
            {error ? (
                <span id={errorId} role="alert" className="text-xs text-error">
                    {error}
                </span>
            ) : null}
        </div>
    );
}
