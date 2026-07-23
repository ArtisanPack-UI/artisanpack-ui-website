<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A single term inside a Keystone dynamic-content taxonomy (#111).
 * See the migration for why terms for admin-created taxonomies live
 * on one shared table instead of a table per taxonomy.
 */
class DynamicContentTerm extends Model
{
    protected $table = 'keystone_dynamic_content_terms';

    /** @var list<string> */
    protected $fillable = ['taxonomy_slug', 'name', 'slug', 'parent_id'];
}
