// React 19 removed the global `JSX` namespace in @types/react — everything
// now lives under `React.JSX`. Some upstream artisanpack-ui packages still
// annotate their component returns as `JSX.Element` (React 18 style), which
// makes TypeScript complain about "Cannot find namespace 'JSX'" when the
// bundle imports them.
//
// This ambient re-declaration bridges the gap without touching vendor
// source. If a package is upgraded to React-19-style types (`React.JSX`),
// this shim continues to work — it just becomes a no-op.

import type { JSX as ReactJSX } from 'react';

// The perf package's `web-vitals` entry is a JS module without a `.d.ts`
// sidecar; the InjectWebVitalsCollector middleware pulls it via a
// dynamic `import()` so the theme-side snippet stays flexible. Declaring
// the module here keeps `tsc --noEmit` from erroring on the string
// literal specifier when a Keystone-side file (e.g. a theme companion)
// wants to import the initializer directly.
declare module '@artisanpack-ui/performance/web-vitals' {
    export function initWebVitals(options?: { endpoint?: string; sampleRate?: number }): void;
}

declare module '@artisanpack-ui/performance/speculative-rules' {
    export function initSpeculativeRules(options?: Record<string, unknown>): void;
}

declare global {
    namespace JSX {
        type Element = ReactJSX.Element;
        type ElementClass = ReactJSX.ElementClass;
        type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
        type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
        type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
        type IntrinsicAttributes = ReactJSX.IntrinsicAttributes;
        type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>;
        type IntrinsicElements = ReactJSX.IntrinsicElements;
    }
}
