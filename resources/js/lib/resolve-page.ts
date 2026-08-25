/**
 * Shared Inertia page-key resolution for the client (`app.tsx`) and server
 * (`ssr.tsx`) entry points.
 *
 * Keystone pages live in two roots:
 *
 *   - core:   `resources/js/pages/**\/*.tsx`
 *   - module: `Modules/<Name>/resources/js/pages/**\/*.tsx`
 *
 * Both roots are flattened into ONE map keyed by the path relative to their
 * own `pages/` directory, so a controller's `Inertia::render('admin/posts/index')`
 * resolves identically no matter which root owns the file. Page keys are a hard
 * invariant of the modular migration — moving a page into a module must never
 * change the key its controller renders (see
 * `plans/14-modular-laravel-setup.md` §3.4).
 *
 * Both entries MUST call {@link buildPageMap} rather than indexing the raw glob
 * output. `import.meta.glob` only accepts literal patterns, so the two globs
 * still live at their call sites — but the key derivation and the duplicate
 * guard live here exactly once, which is what keeps `ssr.tsx` from silently
 * drifting away from `app.tsx`.
 */

/** `import.meta.glob` output: source path → lazy loader (or the eager module). */
type GlobRecord<TModule> = Record<string, TModule>;

/** Core pages glob root, relative to `resources/js/`. */
const APP_PAGES_ROOT = './pages/';

/**
 * Module pages glob root. Matched as a substring rather than a prefix because
 * the module glob is written relative to `resources/js/`, so every key arrives
 * as `../../Modules/<Name>/resources/js/pages/...`.
 */
const MODULE_PAGES_ROOT = '/resources/js/pages/';

const PAGE_EXTENSION = '.tsx';

/**
 * Derive the Inertia page key from a core-pages glob path.
 *
 * `'./pages/admin/posts/index.tsx'` → `'admin/posts/index'`.
 */
function appPageKey(path: string): string | null {
    if (!path.startsWith(APP_PAGES_ROOT) || !path.endsWith(PAGE_EXTENSION)) {
        return null;
    }

    return path.slice(APP_PAGES_ROOT.length, -PAGE_EXTENSION.length);
}

/**
 * Derive the Inertia page key from a module-pages glob path.
 *
 * `'../../Modules/Blog/resources/js/pages/admin/posts/index.tsx'`
 *   → `'admin/posts/index'`.
 */
function modulePageKey(path: string): string | null {
    const rootAt = path.indexOf(MODULE_PAGES_ROOT);
    if (rootAt === -1 || !path.endsWith(PAGE_EXTENSION)) {
        return null;
    }

    return path.slice(rootAt + MODULE_PAGES_ROOT.length, -PAGE_EXTENSION.length);
}

/**
 * Report a page key claimed by two different files.
 *
 * In dev this throws, because a collision means one of the two pages is
 * unreachable and the mistake should surface the moment the offending file is
 * added. In a production bundle it only warns and keeps the entry registered
 * first (core pages win over module pages), so a packaging slip degrades to one
 * shadowed page rather than a blank admin.
 */
function reportDuplicatePageKey(key: string, existingPath: string, duplicatePath: string): void {
    const message =
        `Duplicate Inertia page key "${key}": ` +
        `"${existingPath}" and "${duplicatePath}" both resolve to it. ` +
        'Page keys must be unique across resources/js/pages and every Modules/*/resources/js/pages root.';

    if (import.meta.env.DEV) {
        throw new Error(message);
    }

    console.error(message);
}

/**
 * Flatten the core and module page globs into a single page-key → module map.
 *
 * Core pages are registered first so that, in a production build where a
 * collision only warns, the core page is the one that stays reachable.
 */
export function buildPageMap<TModule>(
    appPages: GlobRecord<TModule>,
    modulePages: GlobRecord<TModule>,
): GlobRecord<TModule> {
    // Null-prototype: callers index this map with the page name straight off the
    // Inertia response, so an inherited `Object.prototype` member — a page named
    // `constructor` or `toString` — would otherwise resolve to a function and be
    // invoked as a page loader. The old key shape (`./pages/${name}.tsx`) could
    // never collide with a prototype member; a bare page key can.
    const pages: GlobRecord<TModule> = Object.create(null) as GlobRecord<TModule>;
    const sources: Record<string, string> = Object.create(null) as Record<string, string>;

    const register = (path: string, key: string | null, module: TModule): void => {
        if (key === null) {
            return;
        }
        if (key in pages) {
            reportDuplicatePageKey(key, sources[key], path);
            return;
        }
        pages[key]   = module;
        sources[key] = path;
    };

    for (const [path, module] of Object.entries(appPages)) {
        register(path, appPageKey(path), module);
    }

    for (const [path, module] of Object.entries(modulePages)) {
        register(path, modulePageKey(path), module);
    }

    return pages;
}

/**
 * The error thrown when no root — core, module, or the federated plugin
 * manifest — claims the requested page key. Shared so both entries report the
 * same thing.
 */
export function pageNotFoundError(name: string): Error {
    return new Error(
        `Inertia page not found: "${name}". ` +
            'Looked in resources/js/pages, Modules/*/resources/js/pages, and the federated plugin manifest.',
    );
}
