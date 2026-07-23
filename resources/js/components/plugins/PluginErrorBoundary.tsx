import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Isolates plugin-supplied React pages loaded over Module Federation from
 * the rest of the Keystone admin shell.
 *
 * Federated bundles can fail in ways local pages cannot: the remote entry
 * URL can 404, the plugin's exposed module can throw during evaluation, or
 * a page component can throw at render. Any of those would ordinarily
 * propagate up and crash the entire admin. This boundary catches the
 * failure, logs it, and renders a scoped, plugin-named fallback so the
 * user can navigate away without a full page reload.
 *
 * Async loader errors surfaced by the resolver reach this boundary via
 * React's Suspense→error path — the Inertia app.tsx re-throws the loader
 * error inside a lazy component so the nearest boundary catches it. Reset
 * behavior is intentionally minimal (no auto-retry) because the failure
 * modes are almost always plugin-side and a user retry loop would hammer a
 * broken remote entry.
 */
type Props = {
    /** The plugin remote name — surfaces in the fallback UI. */
    pluginName: string;
    /** The page that was requested — used to disambiguate multi-page plugins. */
    pageName: string;
    /** The plugin page itself. */
    children?: ReactNode;
};

type State = {
    error: Error | null;
};

export class PluginErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // Surfacing the failure in the browser console gives the user a
        // stack trace to hand to the plugin author; the admin shell has
        // no visibility into remote-bundle internals otherwise.
        console.error(
            `[keystone] plugin "${this.props.pluginName}" failed while rendering "${this.props.pageName}":`,
            error,
            info,
        );
    }

    render(): ReactNode {
        const { error } = this.state;
        if (!error) {
            return this.props.children;
        }

        return (
            <div
                role="alert"
                className="mx-auto my-8 max-w-2xl rounded-lg border border-error/40 bg-error/5 p-6 text-sm"
            >
                <h2 className="text-base font-semibold text-error">
                    The <code className="font-mono">{this.props.pluginName}</code> plugin failed to load.
                </h2>
                <p className="mt-2 text-base-content/80">
                    The plugin page <code className="font-mono">{this.props.pageName}</code> did not render. Try deactivating the plugin from the
                    plugin admin, or check the browser console for details you can send to the plugin author.
                </p>
                <p className="mt-3 font-mono text-xs text-base-content/60">{error.message}</p>
            </div>
        );
    }
}
