import { useState } from 'react';
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
    placeholderLabel = '+ Set featured image',
    modalTitle = 'Choose a featured image',
}: FeaturedImagePickerProps) {
    const [open, setOpen] = useState(false);

    function handleSelect(media: Media[]) {
        const picked = media[0];
        if (!picked) {
            return;
        }
        onChange({
            id: picked.id,
            url: picked.url,
            title: picked.title ?? null,
            alt_text: picked.alt_text ?? null,
            mime_type: picked.mime_type,
        });
    }

    function clear() {
        onChange(null);
    }

    return (
        <div className="flex flex-col gap-3">
            {value ? (
                <div className="flex items-start gap-4">
                    <div className="h-32 w-32 overflow-hidden rounded-md border border-base-300/60 bg-base-200">
                        {value.mime_type.startsWith('image/') ? (
                            <img
                                src={value.url}
                                alt={value.alt_text ?? value.title ?? ''}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-3xl">📎</div>
                        )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <div className="text-sm font-semibold text-base-content">
                            {value.title ?? 'Untitled'}
                        </div>
                        {value.alt_text && (
                            <div className="text-xs text-base-content/65">{value.alt_text}</div>
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
                allowedTypes={['image']}
                context={context}
                title={modalTitle}
            />
        </div>
    );
}
