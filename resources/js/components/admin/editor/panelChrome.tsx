import { createContext, useContext, type KeyboardEventHandler, type ReactNode } from 'react';

/**
 * The reorder chrome one editor panel renders in its own header: the drag
 * handle, the `⋮` menu, and the collapse state the menu drives.
 *
 * It travels by context rather than by prop so the panel components
 * (`CategoriesPanel`, `SeoMetaCard`, …) stay unaware of reordering — they
 * already render a `CollapsibleCard` (or, for Publish, their own header),
 * and that shared chrome is the single place that has to opt in.
 *
 * @see SortablePanel for the provider, and `CollapsibleCard` / `PublishPanel`
 *      for the two consumers.
 */
export interface EditorPanelChrome {
    /** Stable panel id — matches the registry and the persisted order. */
    panelId: string;
    /** Drag handle + `⋮` menu, ready to drop into a panel header. */
    controls: ReactNode;
    /**
     * ⌘↑ / ⌘↓ / ⌘← / ⌘→ reorder shortcuts. Attach to the panel's header
     * row, not the panel root — bound to the root it would swallow
     * ⌘-arrow inside the panel's own text inputs.
     */
    onHeaderKeyDown: KeyboardEventHandler<HTMLElement>;
    /** `false` for Publish, which owns the only Save button on the screen. */
    collapsible: boolean;
    /** Whether the body is collapsed right now. */
    collapsed: boolean;
    /** Collapse or expand the body, persisting the choice. */
    setCollapsed: (collapsed: boolean) => void;
}

const EditorPanelChromeContext = createContext<EditorPanelChrome | null>(null);

export function EditorPanelChromeProvider({
    value,
    children,
}: {
    value: EditorPanelChrome | null;
    children: ReactNode;
}) {
    return (
        <EditorPanelChromeContext.Provider value={value}>
            {children}
        </EditorPanelChromeContext.Provider>
    );
}

/**
 * Read the chrome for the panel currently being rendered, or `null`
 * outside the editor's sortable columns (the Dynamic Content editor also
 * uses `CollapsibleCard`, and it has no reorderable layout).
 *
 * A consumer MUST re-provide `null` around its children — see
 * `CollapsibleCard`. A panel body containing a nested `CollapsibleCard`
 * would otherwise grow a second drag handle that reorders its parent.
 */
export function useEditorPanelChrome(): EditorPanelChrome | null {
    return useContext(EditorPanelChromeContext);
}
