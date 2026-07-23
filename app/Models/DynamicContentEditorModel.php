<?php

declare(strict_types=1);

namespace App\Models;

use ArtisanPackUI\VisualEditor\Concerns\HasBlockContent;
use Illuminate\Database\Eloquent\Model;

/**
 * Single Eloquent model shared by every Keystone-created content type
 * so the visual editor can edit records of any registered slug without
 * needing per-type PHP classes.
 *
 * The table isn't set here on purpose — {@see \App\SiteEditor\KeystoneResourceResolver}
 * subclasses the framework's `ResourceResolver` and calls
 * `setTable($contentType->table_name)` at the exact seam where the
 * resource slug is already in hand. That keeps the constructor plain
 * (no request-state coupling), so queued jobs, factories, deserialized
 * SerializesModels payloads, and Eloquent event listeners can all
 * instantiate the model without crashing on missing route parameters.
 *
 * Reads/writes go through `HasBlockContent`, which persists the block
 * tree to a JSON-cast column named `content`. That column is
 * provisioned on content-type creation by
 * {@see \App\Http\Controllers\Admin\ContentModel\ContentTypeController::ensureRecordsTable()}.
 */
class DynamicContentEditorModel extends Model
{
    use HasBlockContent;

    /** @var array<int, string> */
    protected $fillable = ['title', 'content', 'excerpt'];

    /**
     * The visual editor's `HasBlockContent` trait defaults to the
     * column named `content`, which matches the schema
     * {@see \App\Http\Controllers\Admin\ContentModel\ContentTypeController::ensureRecordsTable()}
     * lays down when `supports` includes `content`.
     */
    protected $blockContentColumn = 'content';

    /**
     * Repository convention: declare casts via the protected method
     * instead of the legacy `$casts` property so future Laravel
     * upgrades that formalize the method as the primary hook see us
     * declaring intent in the same place as everywhere else.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'content' => 'array',
        ];
    }
}
