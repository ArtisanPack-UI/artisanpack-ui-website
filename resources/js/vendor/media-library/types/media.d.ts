/**
 * ArtisanPack UI Media Library - TypeScript Type Definitions
 *
 * Type definitions for the media library API responses and configuration.
 * These types match the output of MediaResource and the API controllers.
 *
 * Publish with: php artisan vendor:publish --tag=media-types
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

// =============================================================================
// Enums & Union Types
// =============================================================================

/**
 * High-level media type categories.
 */
export type MediaType = 'image' | 'video' | 'audio' | 'document';

/**
 * Built-in image size names. Custom sizes registered via
 * `apRegisterImageSize()` will use arbitrary string keys.
 */
export type ImageSize = 'thumbnail' | 'medium' | 'large' | 'full' | (string & {});

/**
 * Sortable fields for media list queries.
 */
export type MediaSortField =
    | 'created_at'
    | 'updated_at'
    | 'title'
    | 'file_name'
    | 'file_size'
    | 'mime_type';

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

// =============================================================================
// Model Types (matching MediaResource output)
// =============================================================================

/**
 * A single media item as returned by MediaResource::toArray().
 */
export interface Media {
    id: number;
    title: string | null;
    file_name: string;
    file_path: string;
    url: string;
    disk: string;
    mime_type: string;
    file_size: number;
    human_size: string;
    alt_text: string | null;
    caption: string | null;
    description: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    metadata: ImageMetadata | VideoMetadata | AudioMetadata | DocumentMetadata | null;
    is_image: boolean;
    is_video: boolean;
    is_audio: boolean;
    is_document: boolean;
    folder: MediaFolderRef;
    uploaded_by: MediaUserRef;
    tags: MediaTag[];
    created_at: string | null;
    updated_at: string | null;
    deleted_at: string | null;
}

/**
 * Inline folder reference embedded in a Media response.
 */
export interface MediaFolderRef {
    id: number | null;
    name: string | null;
}

/**
 * Inline user reference embedded in a Media response.
 */
export interface MediaUserRef {
    id: number | null;
    name: string | null;
}

/**
 * A media folder with relationships.
 */
export interface MediaFolder {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parent_id: number | null;
    created_by: number | null;
    parent: MediaFolder | null;
    children: MediaFolder[];
    media_count?: number;
    created_at: string;
    updated_at: string;
}

/**
 * A media tag.
 */
export interface MediaTag {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    media_count?: number;
}

// =============================================================================
// Metadata Discriminated Union
// =============================================================================

/**
 * Base metadata fields shared across all media types.
 */
export interface BaseMetadata {
    [key: string]: unknown;
}

/**
 * Image-specific metadata.
 */
export interface ImageMetadata extends BaseMetadata {
    exif?: Record<string, unknown>;
    sizes?: Record<string, string>;
}

/**
 * Video-specific metadata.
 */
export interface VideoMetadata extends BaseMetadata {
    codec?: string;
    bitrate?: number;
    frame_rate?: number;
}

/**
 * Audio-specific metadata.
 */
export interface AudioMetadata extends BaseMetadata {
    codec?: string;
    bitrate?: number;
    sample_rate?: number;
    channels?: number;
}

/**
 * Document-specific metadata.
 */
export interface DocumentMetadata extends BaseMetadata {
    page_count?: number;
    author?: string;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Laravel pagination links.
 */
export interface PaginationLinks {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
}

/**
 * Laravel pagination meta.
 */
export interface PaginationMeta {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
    links: Array<{
        url: string | null;
        label: string;
        active: boolean;
    }>;
}

/**
 * Paginated media list response from GET /api/media.
 */
export interface MediaListResponse {
    data: Media[];
    links: PaginationLinks;
    meta: PaginationMeta;
}

/**
 * Single media upload response from POST /api/media.
 */
export interface MediaUploadResponse {
    data: Media;
}

/**
 * Single media item response from GET /api/media/{id}.
 */
export interface MediaShowResponse {
    data: Media;
}

/**
 * Folder list response from GET /api/media-folders.
 */
export interface FolderListResponse {
    data: MediaFolder[];
}

/**
 * Nested folder tree response. Each root folder has recursively
 * loaded children.
 */
export interface FolderTreeResponse {
    data: MediaFolder[];
}

/**
 * Tag list response from GET /api/media-tags.
 */
export interface TagListResponse {
    data: MediaTag[];
}

/**
 * Storage usage breakdown by media type.
 */
export interface MediaTypeBreakdown {
    type: MediaType;
    count: number;
    size: number;
    human_size: string;
}

/**
 * Media statistics response shape.
 */
export interface MediaStatisticsResponse {
    total_count: number;
    total_size: number;
    total_human_size: string;
    folder_count: number;
    tag_count: number;
    type_breakdown: MediaTypeBreakdown[];
    recent_uploads: Media[];
}

// =============================================================================
// Request / Filter Types
// =============================================================================

/**
 * Filter parameters for GET /api/media.
 */
export interface MediaFilter {
    folder_id?: number;
    tag?: string;
    type?: MediaType | string;
    search?: string;
    sort_by?: MediaSortField;
    sort_order?: SortDirection;
    per_page?: number;
    page?: number;
}

/**
 * Sort configuration for media queries.
 */
export interface MediaSort {
    field: MediaSortField;
    direction: SortDirection;
}

/**
 * Payload for creating / uploading a media item (POST /api/media).
 */
export interface MediaUploadPayload {
    file: File;
    title?: string;
    alt_text?: string;
    caption?: string;
    description?: string;
    folder_id?: number;
    tags?: number[];
}

/**
 * Payload for updating a media item (PUT /api/media/{id}).
 */
export interface MediaUpdatePayload {
    title?: string;
    alt_text?: string;
    caption?: string;
    description?: string;
    folder_id?: number | null;
    tags?: number[];
}

// =============================================================================
// Configuration Types (from server config)
// =============================================================================

/**
 * Image size configuration as defined in config/artisanpack/media.php.
 */
export interface ImageSizeConfig {
    width: number | null;
    height: number | null;
    crop: boolean;
}

/**
 * Upload configuration derived from the server config. Useful for
 * client-side validation before uploading.
 */
export interface UploadConfig {
    max_file_size: number;
    allowed_mime_types: string[];
    image_sizes: Record<string, ImageSizeConfig>;
    enable_modern_formats: boolean;
    modern_format: 'webp' | 'avif';
}

/**
 * Response shape for GET /api/media/config.
 *
 * @since 1.2.0
 */
export interface MediaConfigResponse {
    upload: {
        max_file_size: number;
        max_file_size_human: string;
        allowed_mime_types: Record<string, string[]>;
        allowed_extensions: string[];
    };
    image_sizes: Record<string, ImageSizeConfig>;
    features: {
        webp_conversion: boolean;
        avif_conversion: boolean;
    };
}

/**
 * Block media requirements as defined in config/artisanpack/media.php.
 */
export interface BlockMediaRequirements {
    types: MediaType[];
    max_files: number;
    min_files: number;
    allowed_extensions?: string[];
    recommended_dimensions?: {
        width: number;
        height: number;
    };
}

// =============================================================================
// Component Props Types
// =============================================================================

/**
 * Options for the MediaPicker / MediaModal component.
 */
export interface MediaPickerOptions {
    multi_select: boolean;
    max_selections?: number;
    allowed_types?: MediaType[];
    context?: string;
    default_view?: 'grid' | 'list';
    show_upload_tab?: boolean;
    enable_reorder?: boolean;
    show_details_panel?: boolean;
}

/**
 * Event payload emitted when media is selected in the picker.
 */
export interface MediaSelectedEvent {
    media: Media[];
    context: string;
}
