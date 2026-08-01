<?php

declare(strict_types=1);

namespace App\Support\Media;

use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/**
 * The single definition of "this id must name a usable image in the
 * media library".
 *
 * Every media-id field in the admin (featured images, avatars, OG /
 * Twitter images) shares two requirements:
 *
 * 1. The row must be an image — `mime_type LIKE 'image/%'`.
 * 2. The row must not be trashed. `ArtisanPackUI\MediaLibrary\Models\Media`
 *    uses `SoftDeletes`, but `Rule::exists()` queries the table directly
 *    and does not apply the model's global scopes, so a bare `exists`
 *    happily accepts a deleted row. Persisting one produces a reference
 *    the UI can never render, because `Media::find()` honours the scope.
 *
 * Keeping the rule in one place is what stops the call sites from
 * drifting into different strictness levels again (see #195).
 */
class ImageMediaRule
{
    /**
     * The full rule set for a nullable media-id field, ready to drop into
     * a `rules()` array.
     *
     * A fresh `Exists` instance per call: the rule object is mutable, so
     * a shared one could be reconfigured by any caller.
     *
     * @return array<int, Exists|string>
     */
    public static function nullable(): array
    {
        return [
            'nullable',
            'integer',
            Rule::exists('media', 'id')
                ->where(fn (Builder $query) => $query->where('mime_type', 'like', 'image/%'))
                ->withoutTrashed(),
        ];
    }
}
