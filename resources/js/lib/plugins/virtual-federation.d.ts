declare module 'virtual:__federation__' {
    /**
     * Configuration accepted by `__federation_method_setRemote`. Matches the
     * `@originjs/vite-plugin-federation` runtime contract:
     *   - `url`: the remote entry URL, either as a string OR a lazy provider
     *     that resolves to one (useful for signed / short-lived entry URLs).
     *   - `format` and `from` are required — the runtime dispatches on both
     *     to pick the right loader; omitting either surfaces later as an
     *     opaque init failure.
     */
    export interface FederationRemoteConfig {
        url: string | (() => Promise<string>);
        format: 'esm' | 'systemjs' | 'var';
        from: 'vite' | 'webpack';
    }

    export function __federation_method_setRemote(
        name: string,
        config: FederationRemoteConfig,
    ): void;

    export function __federation_method_getRemote(name: string, module: string): Promise<unknown>;

    export function __federation_method_unwrapDefault(module: unknown): unknown;
}
