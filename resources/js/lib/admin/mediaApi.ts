import { applyFilters, doAction } from '@artisanpack-ui/hooks-js';
import { uploadMedia as vendorUploadMedia } from '@/vendor/media-library';
import type { MediaUploadResponse } from '@/vendor/media-library/types/media';

/**
 * Keystone-owned upload boundary. Wraps the vendor `uploadMedia` call
 * with `keystone.admin.media.upload.before` (filter) and
 * `keystone.admin.media.upload.after` (action) so plugin authors have
 * a stable public entry point that lets them tap uploads without
 * reaching into the vendor bundle.
 *
 * Prefer this over importing `uploadMedia` directly from
 * `@/vendor/media-library` for any Keystone-owned upload UI — plugin
 * subscribers only see the traffic that flows through here.
 */
/**
 * Optional context threaded through the hook chain so plugins can
 * distinguish uploads originating from a specific admin surface
 * (`resource: 'posts'`) from cross-cutting ones. Callers pass this
 * when they know which resource is initiating the upload.
 */
export interface UploadHookContext {
    /** Resource slug used to dispatch `.{resource}.media.upload.*` aliases. */
    resource?: string;
    /** Free-form context string surfaced to subscribers (e.g. `'featured-image'`). */
    context?: string;
}

export async function uploadMedia(
    file: File,
    metadata: Record<string, string | number | number[]> = {},
    onProgress?: (percent: number) => void,
    hookContext: UploadHookContext = {},
): Promise<MediaUploadResponse> {
    const { resource, context } = hookContext;
    const beforeCtx = { onProgress, resource, context };

    // `keystone.admin.media.upload.before` — filter the outgoing
    // upload payload. Plugins can rewrite the file (e.g. strip EXIF
    // client-side before it leaves the browser), inject metadata
    // (a plugin-specific folder id, custom tags), or attach a
    // per-upload analytics correlation id. Args:
    // `({ file, metadata }, { onProgress, resource, context })`.
    // Return the (possibly rewritten) payload; return `false` to veto
    // the upload — the wrapper rejects with a `MediaUploadVetoed`
    // exception so callers can distinguish a plugin-veto from a
    // network failure.
    //
    // Runs generic-first, then through the resource-scoped alias so
    // resource-targeted plugins can subscribe to just their surface.
    const generic = applyFilters<{ file: File; metadata: typeof metadata } | false>(
        'keystone.admin.media.upload.before',
        { file, metadata },
        beforeCtx,
    );
    if (generic === false) {
        throw Object.assign(new Error('Upload vetoed by a plugin subscriber.'), {
            name: 'MediaUploadVetoed',
        });
    }
    const filtered = resource
        ? applyFilters<{ file: File; metadata: typeof metadata } | false>(
            `keystone.admin.${resource}.media.upload.before`,
            generic,
            beforeCtx,
        )
        : generic;
    if (filtered === false) {
        throw Object.assign(new Error('Upload vetoed by a plugin subscriber.'), {
            name: 'MediaUploadVetoed',
        });
    }

    const response = await vendorUploadMedia(
        filtered.file,
        filtered.metadata,
        onProgress,
    );

    // `keystone.admin.media.upload.after` — post-upload notification.
    // Fires only on a successful upload; a rejected promise from the
    // vendor call bypasses this on purpose so subscribers don't have to
    // guard on a partial response shape. Args: `(response, { file,
    // metadata, resource, context })`.
    const afterCtx = {
        file:     filtered.file,
        metadata: filtered.metadata,
        resource,
        context,
    };
    doAction('keystone.admin.media.upload.after', response, afterCtx);
    if (resource) {
        doAction(`keystone.admin.${resource}.media.upload.after`, response, afterCtx);
    }

    return response;
}
