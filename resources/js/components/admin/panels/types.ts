/**
 * Shape of a single panel entry as it arrives from the server in the
 * `contentEdit` Inertia prop. Matches `PanelSlotSupport::normalize()`.
 */
export type ContentEditEntry = {
    slug: string;
    title: string | null;
    component: string;
    position: string;
    order: number;
    props: Record<string, unknown>;
    /** Federated remote name, if the entry loads over Module Federation. */
    remote?: string;
    /** Absolute URL to the plugin's `remoteEntry.js`. */
    entry?: string;
    /** Exposed module identifier inside the remote (e.g. `./AnalyticsPanel`). */
    module?: string;
};

/**
 * Shape of the shared `contentEdit` payload — one bucket per registry
 * hook on the framework's `ContentEditExtensions` manager.
 */
export type ContentEditPayload = {
    panels: ContentEditEntry[];
    tabs: ContentEditEntry[];
    beforeEditor: ContentEditEntry[];
    afterEditor: ContentEditEntry[];
};

/** Slot the `<AdminEditSlot>` component renders. */
export type SlotName =
    | 'sidebar-top'
    | 'sidebar-bottom'
    | 'tabs'
    | 'before-editor'
    | 'after-editor'
    // `before-form` / `after-form` are client-only slots — the PHP
    // `PanelSlotSupport` payload doesn't ship entries for them yet, so
    // the initial list is empty and only the
    // `keystone.admin.panels.entries` filter can populate them. Kept as
    // first-class slot names so plugins have a stable extension point
    // above / below the entire form even before the server-side bucket
    // lands.
    | 'before-form'
    | 'after-form';

/**
 * Shape of a panel record shipped to the panel body when it renders.
 * Plugins receive this in addition to their declared `props` so they
 * know which content type + record they were mounted for.
 */
export type PanelContext = {
    contentType: string;
    record: Record<string, unknown>;
};
