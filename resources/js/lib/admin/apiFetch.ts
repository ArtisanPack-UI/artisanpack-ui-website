import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';

/**
 * Context passed to every `keystone.admin.api.*` hook so a subscriber
 * has enough breadcrumbs to correlate request → response → error across
 * multiple in-flight calls without threading its own request ids
 * through every caller.
 */
export interface ApiFetchContext {
    /** Resolved absolute-or-relative URL of the request. */
    url: string;
    /** HTTP method (uppercased). Defaults to `GET` when `init` omits it. */
    method: string;
    /**
     * Which lib/admin/*Api.ts file the call originated from. Useful for
     * scoping subscribers by API surface without inspecting the URL.
     */
    source: string;
}

/**
 * Shared fetch wrapper for every `lib/admin/*Api.ts` client so the
 * plugin extension seams (#152) — `keystone.admin.api.request` filter,
 * `keystone.admin.api.response` action, `keystone.admin.api.error`
 * action — fire uniformly regardless of which admin surface issued the
 * call. Subscribers can mutate request headers/body via the request
 * filter, mirror responses into a Sentry-like adapter via the response
 * action, and route thrown errors through their own reporting via the
 * error action.
 *
 * `keystone.admin.api.request` filter contract:
 *   `(RequestInit, ApiFetchContext) => RequestInit`. Return the mutated
 *   init object; returning `false` is NOT observed here — plugins that
 *   want to veto a request should throw from the filter.
 *
 * `keystone.admin.api.response` action contract:
 *   `(Response, ApiFetchContext)`. Fires exactly once per fetch that
 *   resolved with a Response (HTTP errors count — a 500 is still a
 *   response). The Response is not consumed here so subscribers can
 *   safely `.clone()` it to peek at the body.
 *
 * `keystone.admin.api.error` action contract:
 *   `(unknown, ApiFetchContext)`. Fires when the underlying fetch
 *   rejects (network failure, aborted, DNS). Subscribers get whatever
 *   the fetch layer threw.
 */
export async function apiFetch(
    input: string,
    init: RequestInit,
    source: string,
): Promise<Response> {
    const context: ApiFetchContext = {
        url:    input,
        method: (init.method ?? 'GET').toUpperCase(),
        source,
    };

    const filterResult = applyFilters<RequestInit | null | undefined>(
        'keystone.admin.api.request',
        init,
        context,
    );

    // Guard: a subscriber that returns nullish or a non-object (accident,
    // not the documented veto-via-throw path) would otherwise crash the
    // fetch — and since this helper backs every admin API surface, one
    // bad subscriber would blank the whole admin. Fall back to the raw
    // init, matching the "safe subscriber" posture used elsewhere.
    const filteredInit: RequestInit =
        null != filterResult && 'object' === typeof filterResult
            ? filterResult
            : init;

    // The request filter can override `method` (e.g. a plugin that
    // proxies GETs through POST). Refresh the context so the response
    // / error hooks see the method that actually went over the wire,
    // not the pre-filter value the caller passed in.
    context.method = (filteredInit.method ?? context.method).toUpperCase();

    try {
        const response = await fetch(input, filteredInit);
        safeDoAction('keystone.admin.api.response', response, context);
        return response;
    } catch (error) {
        safeDoAction('keystone.admin.api.error', error, context);
        throw error;
    }
}

/**
 * Fire an action without letting a throwing subscriber escape the
 * `apiFetch()` call site. The hooks-js primitive does not isolate
 * subscriber throws, so a bad `.api.response` subscriber would
 * otherwise turn every successful fetch into an unhandled rejection
 * — breaking notifications polling, settings PUTs, and CSRF init all
 * at once. We swallow the subscriber's throw and surface it via
 * `console.error` so plugin authors still see the failure.
 */
function safeDoAction(hook: string, ...args: unknown[]): void {
    try {
        doAction(hook, ...args);
    } catch (error) {
        console.error(`[keystone] subscriber of ${hook} threw:`, error);
    }
}
