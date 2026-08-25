<?php

declare(strict_types=1);

namespace App\Support\ContentEdit;

/**
 * Canonical registry of the editor's chrome view modes (issue #239).
 *
 * The mode strings here are persisted in `user_editor_preferences.view_mode`
 * and mirrored verbatim by the frontend in
 * `resources/js/lib/admin/editorChrome.ts`. Keep the two in sync — a value
 * that exists on only one side either can never be selected (frontend
 * missing) or is normalised away to {@see DEFAULT} on read (backend missing).
 *
 * - **Normal** — the shipped two-column editor inside the full admin chrome.
 * - **Full-width** — the left admin sidebar is hidden so the editor column
 *   expands; topbar and the right settings sidebar remain.
 * - **Distraction-free** — the admin sidebar and topbar are both hidden and
 *   the visual editor fills the screen.
 *
 * The mode is a single per-(user, post type) value rather than a set, so —
 * unlike the panel lists in {@see EditorPanels} — it needs only a normalise
 * step, not a filter that drops unknown members.
 */
final class EditorViewModes
{
    public const NORMAL = 'normal';

    public const FULL_WIDTH = 'full-width';

    public const DISTRACTION_FREE = 'distraction-free';

    /**
     * The mode a user gets before they have saved anything — today's layout
     * inside the full admin chrome.
     */
    public const DEFAULT = self::NORMAL;

    /**
     * Every selectable mode, in cycle order (Normal → Full-width →
     * Distraction-free). The frontend switcher renders them in this order.
     *
     * @var list<string>
     */
    public const MODES = [self::NORMAL, self::FULL_WIDTH, self::DISTRACTION_FREE];

    /**
     * Reduce a caller-supplied value to a known mode, mapping anything
     * unrecognised (a retired mode, a null column on a freshly created row,
     * a hand-edited record) to {@see DEFAULT} rather than rejecting it — the
     * same "silently heal orphans" posture as {@see EditorPanels::filter()}.
     */
    public static function normalize(mixed $mode): string
    {
        return is_string($mode) && in_array($mode, self::MODES, true)
            ? $mode
            : self::DEFAULT;
    }
}
