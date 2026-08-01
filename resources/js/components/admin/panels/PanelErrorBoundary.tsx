import { Component, type ErrorInfo, type ReactNode } from 'react';
import { doAction } from '@artisanpack-ui/hooks-js';

/**
 * Isolates a single plugin-supplied edit-screen panel from the rest of
 * the admin. A panel that throws — during render, during a federated
 * bundle load, or during effect setup — is caught here and replaced
 * with a scoped fallback so the surrounding form stays interactive.
 *
 * Mirrors {@link file://./../../plugins/PluginErrorBoundary.tsx} but
 * carries the panel slug rather than the plugin remote name so the
 * fallback UI can point at the specific misbehaving panel when a
 * single plugin ships multiple panels into the same edit screen.
 */
type Props = {
    /** The panel's stable slug — surfaced in the fallback UI. */
    slug: string;
    /** Optional plugin name for a friendlier fallback message. */
    pluginName?: string;
    /** The panel body itself. */
    children?: ReactNode;
};

type State = {
    error: Error | null;
};

export class PanelErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error(
            `[keystone] edit-screen panel "${this.props.slug}" failed:`,
            error,
            info,
        );
        doAction('keystone.admin.error.boundary', {
            scope:      'panel',
            error,
            info,
            slug:       this.props.slug,
            pluginName: this.props.pluginName,
        });
        // Panel-scoped variant fires alongside the generic error.boundary
        // action so a plugin can subscribe specifically to panel render
        // failures (surface a per-panel diagnostic, mark the slug unhealthy
        // for the current session, etc.) without filtering on
        // `scope === 'panel'` at every call site.
        doAction('keystone.admin.panels.error', {
            error,
            info,
            slug:       this.props.slug,
            pluginName: this.props.pluginName,
        });
    }

    render(): ReactNode {
        const { error } = this.state;
        if (!error) {
            return this.props.children;
        }

        return (
            <div
                role="alert"
                className="rounded-lg border border-error/40 bg-error/5 p-4 text-sm"
            >
                <div className="font-semibold text-error">
                    Panel failed to render
                </div>
                <div className="mt-1 text-xs text-base-content/70">
                    The {' '}
                    <code className="font-mono">{this.props.slug}</code>{' '}
                    panel
                    {this.props.pluginName && (
                        <>
                            {' '}from{' '}
                            <code className="font-mono">
                                {this.props.pluginName}
                            </code>
                        </>
                    )}{' '}
                    stopped working. Everything else on this page will
                    keep saving normally.
                </div>
                <div className="mt-2 font-mono text-[11px] text-base-content/60">
                    {error.message}
                </div>
            </div>
        );
    }
}
