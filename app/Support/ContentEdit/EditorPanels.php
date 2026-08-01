<?php

declare(strict_types=1);

namespace App\Support\ContentEdit;

/**
 * Canonical registry of the editor's sidebar/main-column panels.
 *
 * The panel ids here are the strings persisted in
 * `user_editor_preferences` (`hidden_panels`, `collapsed_panels`, and both
 * arms of `panel_order`), and they are mirrored verbatim by the frontend
 * registry in `resources/js/components/admin/editor/panels/registry.ts`.
 * Keep the two in sync — a panel that exists on only one side either never
 * appears in Screen Options (frontend missing) or has its saved state
 * silently dropped on write (backend missing).
 *
 * Each panel maps to the `supports` flags that make it relevant. The
 * server does not filter by supports (it has no model instance on the
 * preference write path, and a stale id for an unsupported panel is inert
 * because the panel is not rendered anyway) — the mapping exists so the
 * flags stay documented next to the ids they gate.
 *
 * Publish is orderable but not hideable: as in WordPress classic it owns
 * the only Save button on the screen, so it is excluded from
 * {@see ids()} / {@see filter()} while still being a legal `panel_order`
 * entry.
 */
class EditorPanels
{
    /**
     * The two columns `panel_order` places panels into. `main` is the
     * writing column (below the title and block editor, which are pinned
     * and never appear here); `sidebar` is the metadata column.
     *
     * @var list<string>
     */
    public const COLUMNS = ['main', 'sidebar'];

    /**
     * Panel id => the `supports` flags that make the panel available, plus
     * whether Screen Options may hide it and whether it ships collapsed.
     * An empty `supports` list means the panel is unconditional.
     *
     * Invariant: every hideable panel is also collapsible, and vice versa —
     * Publish is the sole exception to both, for the same reason (it owns
     * the only Save button). {@see filter()} therefore validates
     * `collapsed_panels` against the hideable set rather than carrying a
     * second flag. Add a `collapsible` key here, and a matching filter, the
     * first time a panel needs one without the other.
     *
     * @var array<string, array{supports: list<string>, hideable: bool, collapsed: bool}>
     */
    protected const PANELS = [
        'publish'        => ['supports' => [], 'hideable' => false, 'collapsed' => false],
        'categories'     => ['supports' => ['categories'], 'hideable' => true, 'collapsed' => false],
        'tags'           => ['supports' => ['tags'], 'hideable' => true, 'collapsed' => false],
        'attributes'     => ['supports' => ['page_attributes', 'templates'], 'hideable' => true, 'collapsed' => true],
        'featured_image' => ['supports' => ['featured_image'], 'hideable' => true, 'collapsed' => false],
        'excerpt'        => ['supports' => ['excerpt'], 'hideable' => true, 'collapsed' => false],
        'seo'            => ['supports' => ['seo'], 'hideable' => true, 'collapsed' => true],
        'custom_fields'  => ['supports' => ['custom_fields'], 'hideable' => true, 'collapsed' => false],
    ];

    /**
     * Every hideable panel id — the legal contents of `hidden_panels` and
     * `collapsed_panels`. Publish is neither hideable nor collapsible, so
     * it is absent from both.
     *
     * @return list<string>
     */
    public static function ids(): array
    {
        return array_keys(array_filter(
            static::PANELS,
            static fn (array $panel): bool => $panel['hideable'],
        ));
    }

    /**
     * Every panel that can appear in `panel_order`, including Publish.
     *
     * @return list<string>
     */
    public static function orderableIds(): array
    {
        return array_keys(static::PANELS);
    }

    /**
     * Panels that ship collapsed — the `collapsed_panels` a user gets
     * before they have saved anything.
     *
     * These are the panels that carried no `defaultOpen` on their
     * `CollapsibleCard` before the layout became persisted, so shipping
     * them here keeps a first-time editor looking the way it always has.
     * The value round-trips: the first layout write a user makes sends
     * this set straight back, so the default stops being implicit as soon
     * as there is a row to hold it.
     *
     * @return list<string>
     */
    public static function defaultCollapsedIds(): array
    {
        return array_keys(array_filter(
            static::PANELS,
            static fn (array $panel): bool => $panel['collapsed'],
        ));
    }

    /**
     * Reduce a caller-supplied list to known hideable panel ids,
     * de-duplicated and re-indexed so the value round-trips through
     * `json_encode()` as an array rather than an object.
     *
     * Unknown ids are dropped rather than rejected so a preference row
     * never accumulates panels the editor no longer ships — the same
     * "silently drop orphans" posture as
     * {@see \App\Http\Controllers\Admin\NotificationPreferenceController::update()}.
     *
     * Accepts `mixed` because a freshly created row carries `null` for the
     * JSON columns the insert didn't name — the database default only
     * materializes on the next read.
     *
     * @return list<string>
     */
    public static function filter(mixed $ids): array
    {
        if (! is_array($ids)) {
            return [];
        }

        $known = static::ids();

        $valid = array_filter(
            $ids,
            static fn (mixed $id): bool => is_string($id) && in_array($id, $known, true),
        );

        return array_values(array_unique($valid));
    }

    /**
     * Normalize a caller-supplied `panel_order` into the canonical
     * `{main: [...], sidebar: [...]}` shape.
     *
     * Unknown ids are dropped on the same rationale as {@see filter()}. An
     * id appearing in both columns is kept in the first one it is seen in
     * (`main` before `sidebar`), because a panel rendered twice is worse
     * than a panel rendered in the column the client didn't intend — and
     * the next write from a rendered editor corrects it.
     *
     * Missing ids are NOT back-filled here: the client knows which panels
     * the current post type actually renders and appends the unplaced ones
     * itself, whereas the server has no model instance on this path.
     *
     * @return array{main: list<string>, sidebar: list<string>}
     */
    public static function filterOrder(mixed $order): array
    {
        $known   = static::orderableIds();
        $placed  = [];
        $columns = [];

        foreach (static::COLUMNS as $column) {
            $candidates = is_array($order) && is_array($order[$column] ?? null)
                ? $order[$column]
                : [];

            $ids = [];

            foreach ($candidates as $id) {
                if (is_string($id) && in_array($id, $known, true) && ! in_array($id, $placed, true)) {
                    $placed[] = $id;
                    $ids[]    = $id;
                }
            }

            $columns[$column] = $ids;
        }

        /** @var array{main: list<string>, sidebar: list<string>} $columns */
        return $columns;
    }
}
