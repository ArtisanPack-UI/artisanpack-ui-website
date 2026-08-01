/**
 * Canonical registry of the editor's reorderable panels.
 *
 * The `id` values here are the strings persisted in
 * `user_editor_preferences` (`hidden_panels`, `collapsed_panels`, and both
 * arms of `panel_order`) and are mirrored verbatim by
 * `App\Support\ContentEdit\EditorPanels`. Keep the two in sync — a panel
 * that exists on only one side either never appears in Screen Options
 * (missing here) or has its saved state dropped on write (missing there).
 *
 * Order is the shipped default order, and it is the fallback a first-time
 * user with no saved `panel_order` gets: Publish → Categories → Tags →
 * Page Attributes → Featured image → Excerpt → SEO → Custom fields, all in
 * the sidebar column. Posts and pages share one list because `supports`
 * filtering already removes the entries a given post type can't render (a
 * post never supports `page_attributes`; a page never supports
 * `categories`), so the surviving order is correct for both.
 *
 * Publish is listed but is neither hideable nor collapsible: as in
 * WordPress classic it owns the only Save button on the screen, so hiding
 * it (or collapsing its `inert` body) would make submit unreachable. It is
 * still draggable and still moves between columns.
 */
export interface EditorPanelDefinition {
    /** Stable id persisted in `panel_order` / `hidden_panels`. */
    id: string;
    /** Human label — Screen Options checkbox, panel menu, live announcements. */
    label: string;
    /**
     * The `supports` flags that make this panel available, or `[]` for a
     * panel every post type gets. The panel is offered when the post type
     * supports *any* of them — `attributes` renders when either
     * `page_attributes` or `templates` is on, matching `AttributesPanel`'s
     * own two-flag gate.
     */
    supports: string[];
    /** Screen Options may hide this panel. */
    hideable: boolean;
    /** The panel body can collapse. */
    collapsible: boolean;
    /**
     * The panel ships collapsed — mirrors the absence of `defaultOpen` on
     * its `CollapsibleCard` before the layout became persisted, so a
     * first-time editor looks the way it always has. Kept in sync with
     * `EditorPanels::defaultCollapsedIds()`.
     */
    defaultCollapsed: boolean;
    /**
     * Validation error keys this panel owns, as the server keys them.
     * Matched exactly or as a `key.` prefix, so `seo` covers
     * `seo.meta_title` and `custom_fields` covers `custom_fields.<key>`.
     *
     * Used to force a hidden or collapsed panel back on screen while it
     * holds an error — see {@link panelIdsWithErrors}.
     */
    errorKeys: string[];
}

export const EDITOR_PANELS: EditorPanelDefinition[] = [
    {
        id: 'publish',
        label: 'Publish',
        supports: [],
        hideable: false,
        collapsible: false,
        defaultCollapsed: false,
        errorKeys: ['status', 'published_at'],
    },
    {
        id: 'categories',
        label: 'Categories',
        supports: ['categories'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: false,
        errorKeys: ['category_ids'],
    },
    {
        id: 'tags',
        label: 'Tags',
        supports: ['tags'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: false,
        errorKeys: ['tag_ids'],
    },
    {
        id: 'attributes',
        label: 'Page Attributes',
        supports: ['page_attributes', 'templates'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: true,
        errorKeys: ['parent_id', 'template', 'order'],
    },
    {
        id: 'featured_image',
        label: 'Featured image',
        supports: ['featured_image'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: false,
        errorKeys: ['featured_image_id'],
    },
    {
        id: 'excerpt',
        label: 'Excerpt',
        supports: ['excerpt'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: false,
        errorKeys: ['excerpt'],
    },
    {
        id: 'seo',
        label: 'SEO',
        supports: ['seo'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: true,
        errorKeys: ['seo'],
    },
    {
        id: 'custom_fields',
        label: 'Custom fields',
        supports: ['custom_fields'],
        hideable: true,
        collapsible: true,
        defaultCollapsed: false,
        errorKeys: ['custom_fields'],
    },
];

/** Look up one panel definition, or `undefined` for an unknown id. */
export function panelDefinition(panelId: string): EditorPanelDefinition | undefined {
    return EDITOR_PANELS.find((panel) => panel.id === panelId);
}

/**
 * Panels that ship collapsed, restricted to the ids this screen renders.
 *
 * Mirrors `EditorPanels::defaultCollapsedIds()`. The server ships this set
 * as `collapsed_panels` for a user with no saved row; the client needs its
 * own copy so "Reset layout" restores the same state without a round-trip.
 */
export function defaultCollapsedPanelIds(panelIds: string[]): string[] {
    return EDITOR_PANELS.filter(
        (panel) => panel.defaultCollapsed && panelIds.includes(panel.id),
    ).map((panel) => panel.id);
}

/** Human label for a panel id, falling back to the id itself. */
export function panelLabel(panelId: string): string {
    return panelDefinition(panelId)?.label ?? panelId;
}

/**
 * The panels a post type with the given `supports` flags can render, in
 * shipped default order. Panels the post type doesn't support are not
 * listed at all — a user can neither reorder nor toggle something the
 * content type never renders.
 */
export function panelsForSupports(supports: string[]): EditorPanelDefinition[] {
    return EDITOR_PANELS.filter(
        (panel) =>
            panel.supports.length === 0 || panel.supports.some((flag) => supports.includes(flag)),
    );
}

/**
 * Panels that currently hold a server validation error.
 *
 * A hidden panel is forced back on screen — and a collapsed one forced
 * open — while it has one. Without this, a required custom field or an
 * over-length excerpt inside a panel the user hid makes the form
 * unsaveable with no visible cause: the save fails, and the message
 * explaining why is inside the thing that isn't rendered. Errors win over
 * the saved preference; the panel hides (or re-collapses) itself once the
 * error clears.
 */
export function panelIdsWithErrors(errors: Record<string, string>): string[] {
    const errorKeys = Object.keys(errors);

    return EDITOR_PANELS.filter((panel) =>
        panel.errorKeys.some((owned) =>
            errorKeys.some((key) => key === owned || key.startsWith(`${owned}.`)),
        ),
    ).map((panel) => panel.id);
}
