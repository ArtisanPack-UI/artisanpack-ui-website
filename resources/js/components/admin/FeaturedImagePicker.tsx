import { useState } from 'react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import { MediaModal } from '@/vendor/media-library';
import type { Media } from '@/vendor/media-library/types/media';

/**
 * Slim representation of the featured-image record persisted alongside the
 * resource. Matches the payload emitted by `PageController` /
 * `PostController` so the admin Edit screens can hydrate the picker
 * without re-querying the media library on mount.
 */
export interface FeaturedImageRecord {
    id: number;
    url: string;
    title: string | null;
    alt_text: string | null;
    mime_type: string;
}

interface FeaturedImagePickerProps {
    value: FeaturedImageRecord | null;
    onChange: (value: FeaturedImageRecord | null) => void;
    /** Context label sent to the picker; useful for analytics + multi-instance pages. */
    context?: string;
    /**
     * Resource slug (`'posts'`, `'pages'`, …) used to fan the featured-
     * image / media hooks through the resource-scoped alias in addition
     * to the generic name. Optional so legacy callers still work; when
     * omitted only the generic hook fires.
     */
    resource?: string;
    /** Override the empty-state label (default: "+ Set featured image"). */
    placeholderLabel?: string;
    /** Override the picker modal title (default: "Choose a featured image"). */
    modalTitle?: string;
}

/**
 * Featured image picker built on the media-library `<MediaModal>`. The
 * server sees only `featured_image_id`; the rest of the record is hydrated
 * client-side so we can render a preview without an extra `/api/media/:id`
 * round trip after selection.
 */
export default function FeaturedImagePicker({
    value,
    onChange,
    context = 'featured-image',
    resource,
    placeholderLabel = '+ Set featured image',
    modalTitle = 'Choose a featured image',
}: FeaturedImagePickerProps) {
    const [open, setOpen] = useState(false);

    // Every filter below runs generic-first, then through the
    // resource-scoped alias (`keystone.admin.{resource}.*`) when a
    // `resource` prop was provided. Same pattern DataTable and the
    // edit-form helpers use.
    //
    // `keystone.admin.featuredImage.value` — filters the currently
    // displayed featured-image record on every render. Plugins can
    // rewrite the preview URL through a signed-URL rewriter, blank out
    // the record behind a permission gate, or synthesize a placeholder
    // for a broken upstream. Args: `(value, { context, resource })`;
    // return `null` to render the empty placeholder without clearing
    // the underlying form field.
    const valueCtx = { context, resource };
    const genericValue = applyFilters<FeaturedImageRecord | null>(
        'keystone.admin.featuredImage.value',
        value,
        valueCtx,
    );
    const displayValue = resource
        ? applyFilters<FeaturedImageRecord | null>(
            `keystone.admin.${resource}.featuredImage.value`,
            genericValue,
            valueCtx,
        )
        : genericValue;

    // `keystone.admin.media.picker.filters` — filters the allowed types /
    // advanced-filter chips passed to the shared MediaModal so plugins
    // can widen the picker (accept documents on a page that's normally
    // image-only) or narrow it further. Args: `(filters, { context,
    // component, resource })` where `component` names the caller
    // (here, `'featuredImagePicker'`). Return the (possibly rewritten)
    // filter object.
    const pickerCtx = { context, component: 'featuredImagePicker', resource };
    const genericPickerFilters = applyFilters<{ allowedTypes: Array<'image' | 'video' | 'audio' | 'document'> }>(
        'keystone.admin.media.picker.filters',
        { allowedTypes: ['image'] },
        pickerCtx,
    );
    const pickerFilters = resource
        ? applyFilters<{ allowedTypes: Array<'image' | 'video' | 'audio' | 'document'> }>(
            `keystone.admin.${resource}.media.picker.filters`,
            genericPickerFilters,
            pickerCtx,
        )
        : genericPickerFilters;

    function handleSelect(media: Media[]) {
        const picked = media[0];
        if (!picked) {
            return;
        }
        const record: FeaturedImageRecord = {
            id: picked.id,
            url: picked.url,
            title: picked.title ?? null,
            alt_text: picked.alt_text ?? null,
            mime_type: picked.mime_type,
        };
        // `keystone.admin.featuredImage.accept` — filters a freshly-picked
        // media record before it's written to the parent form. Plugins
        // can rewrite the record (normalize the URL through a CDN
        // rewrite), block a picked item that fails a policy check by
        // returning `null` (the picker treats `null` as "nothing was
        // picked" and leaves the previous value in place), or record an
        // analytics event. Args: `(record, { picked, context, resource })`.
        const acceptCtx = { picked, context, resource };
        const genericAccepted = applyFilters<FeaturedImageRecord | null>(
            'keystone.admin.featuredImage.accept',
            record,
            acceptCtx,
        );
        const accepted = resource
            ? applyFilters<FeaturedImageRecord | null>(
                `keystone.admin.${resource}.featuredImage.accept`,
                genericAccepted,
                acceptCtx,
            )
            : genericAccepted;
        if (!accepted) {
            return;
        }
        onChange(accepted);
    }

    function clear() {
        onChange(null);
    }

    return (
        <div className="flex flex-col gap-3">
            {displayValue ? (
                <div className="flex items-start gap-4">
                    <div className="h-32 w-32 overflow-hidden rounded-md border border-base-300/60 bg-base-200">
                        {displayValue.mime_type.startsWith('image/') ? (
                            <img
                                src={displayValue.url}
                                alt={displayValue.alt_text ?? displayValue.title ?? ''}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-3xl">📎</div>
                        )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <div className="text-sm font-semibold text-base-content">
                            {displayValue.title ?? 'Untitled'}
                        </div>
                        {displayValue.alt_text && (
                            <div className="text-xs text-base-content/65">{displayValue.alt_text}</div>
                        )}
                        <div className="mt-1 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setOpen(true)}
                                className="rounded-md border border-base-300/60 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                            >
                                Replace
                            </button>
                            <button
                                type="button"
                                onClick={clear}
                                className="rounded-md border border-error/30 bg-base-100 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="grid h-32 place-items-center rounded-md border-2 border-dashed border-base-300 bg-base-200/30 text-sm font-semibold text-base-content/65 hover:border-primary hover:text-primary"
                >
                    {placeholderLabel}
                </button>
            )}

            <MediaModal
                open={open}
                onClose={() => setOpen(false)}
                onSelect={handleSelect}
                allowedTypes={pickerFilters.allowedTypes}
                context={context}
                title={modalTitle}
            />
        </div>
    );
}
