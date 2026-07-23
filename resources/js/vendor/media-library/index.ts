/**
 * ArtisanPack UI Media Library - React Components
 *
 * Main entry point for all React media library components and hooks.
 * Import from this file for convenient access to all exports.
 *
 * @example
 * ```tsx
 * import {
 *     MediaLibrary,
 *     MediaModal,
 *     MediaPicker,
 *     useMediaLibrary,
 *     useMediaUpload,
 * } from './react';
 * ```
 *
 * @package ArtisanPackUI\MediaLibrary
 * @since   1.2.0
 */

// =============================================================================
// Hooks
// =============================================================================

export { useMediaLibrary } from './hooks/useMediaLibrary';
export type { UseMediaLibraryOptions, UseMediaLibraryReturn } from './hooks/useMediaLibrary';

export { useMediaUpload } from './hooks/useMediaUpload';
export type {
    UseMediaUploadOptions,
    UseMediaUploadReturn,
    UploadQueueItem,
} from './hooks/useMediaUpload';

export { useMediaPicker } from './hooks/useMediaPicker';
export type { UseMediaPickerOptions, UseMediaPickerReturn } from './hooks/useMediaPicker';

// =============================================================================
// Core Components
// =============================================================================

export { MediaLibrary } from './components/MediaLibrary';
export type { MediaLibraryProps } from './components/MediaLibrary';

export { MediaUpload } from './components/MediaUpload';
export type { MediaUploadProps } from './components/MediaUpload';

export { MediaModal } from './components/MediaModal';
export type { MediaModalProps } from './components/MediaModal';

export { MediaPicker } from './components/MediaPicker';
export type { MediaPickerProps } from './components/MediaPicker';

export { MediaGrid } from './components/MediaGrid';
export type { MediaGridProps } from './components/MediaGrid';

export { MediaItem } from './components/MediaItem';
export type { MediaItemProps } from './components/MediaItem';

// =============================================================================
// Management Components
// =============================================================================

export { MediaEdit } from './components/MediaEdit';
export type { MediaEditProps } from './components/MediaEdit';

export { FolderManager } from './components/FolderManager';
export type { FolderManagerProps } from './components/FolderManager';

export { TagManager } from './components/TagManager';
export type { TagManagerProps } from './components/TagManager';

export { MediaStatistics } from './components/MediaStatistics';
export type { MediaStatisticsProps } from './components/MediaStatistics';

// =============================================================================
// Utilities
// =============================================================================

export {
    configureAuth,
    fetchMedia,
    fetchMediaById,
    uploadMedia,
    updateMedia,
    deleteMedia,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    attachTag,
    detachTag,
    fetchMediaConfig,
} from './utils/api';
