<?php

declare(strict_types=1);

namespace App\Http\Requests\Media;

use ArtisanPackUI\MediaLibrary\Http\Requests\MediaStoreRequest as PackageMediaStoreRequest;

/**
 * Keystone-flavored MediaStoreRequest.
 *
 * The vendor request's protected getAllowedExtensions() carries a closed
 * MIME→extension map. Any MIME listed in artisanpack.media.allowed_mime_types
 * that isn't in that map is silently dropped, so the resulting `mimes:` rule
 * rejects otherwise-allowed uploads (e.g. Apple's audio/x-m4a for m4a files).
 *
 * Subclass extends the map. Bound over the vendor class in
 * {@see \App\Providers\AppServiceProvider::register()}.
 */
class MediaStoreRequest extends PackageMediaStoreRequest
{
    protected function getAllowedExtensions(): array
    {
        $mimeTypes = config('artisanpack.media.allowed_mime_types', []);

        $mimeToExtension = [
            'image/jpeg'                                                              => 'jpg,jpeg',
            'image/jpg'                                                               => 'jpg',
            'image/png'                                                               => 'png',
            'image/gif'                                                               => 'gif',
            'image/webp'                                                              => 'webp',
            'image/avif'                                                              => 'avif',
            'image/svg+xml'                                                           => 'svg',
            'application/pdf'                                                         => 'pdf',
            'application/msword'                                                      => 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.ms-excel'                                                => 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'       => 'xlsx',
            'video/mp4'                                                               => 'mp4',
            'video/mpeg'                                                              => 'mpeg,mpg',
            'video/quicktime'                                                         => 'mov',
            'video/webm'                                                              => 'webm',
            'audio/mpeg'                                                              => 'mp3',
            'audio/wav'                                                               => 'wav',
            'audio/ogg'                                                               => 'ogg',

            'audio/x-m4a' => 'm4a',
            'audio/mp4'   => 'm4a',
            'image/heic'  => 'heic',
            'image/heif'  => 'heif',
        ];

        $extensions = [];
        foreach ($mimeTypes as $mimeType) {
            if (isset($mimeToExtension[$mimeType])) {
                $extensions = array_merge($extensions, explode(',', $mimeToExtension[$mimeType]));
            }
        }

        return array_unique($extensions);
    }
}
