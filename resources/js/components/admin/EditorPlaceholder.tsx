import type { ReactNode } from 'react';

interface EditorPlaceholderProps {
    contentLabel?: string;
    children?: ReactNode;
}

/**
 * Stand-in for the visual editor while artisanpack-ui/visual-editor V1.0.0
 * is still in alpha. Rendered on the Pages / Posts / Site Design edit
 * screens; replaced when the orchestrator Wave 8 integration lands.
 */
export default function EditorPlaceholder({
    contentLabel = 'this page',
    children,
}: EditorPlaceholderProps) {
    return (
        <div className="rounded-xl border border-dashed border-base-300 bg-base-200/30 p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-base-200 text-base-content/55">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="h-6 w-6"
                >
                    <path
                        d="M14.06 9.02 14.98 9.94 5.92 19H5v-.92ZM17.66 3a1 1 0 0 0-.71.29l-1.83 1.83 3.75 3.75 1.83-1.83a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-.7-.29Zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94Z"
                        fill="currentColor"
                    />
                </svg>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">
                Visual editor coming soon
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-base-content/65">
                The block-based editor for {contentLabel} ships in a later
                release. For now, save the page meta below — content blocks
                will be editable once the visual editor lands.
            </p>
            {children && <div className="mt-6">{children}</div>}
        </div>
    );
}
