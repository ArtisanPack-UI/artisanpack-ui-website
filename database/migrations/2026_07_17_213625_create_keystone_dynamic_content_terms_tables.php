<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Storage for taxonomy terms and their record assignments on Keystone
 * dynamic content types (#111).
 *
 * The framework's `taxonomies` table declares that a taxonomy exists
 * and which content type it binds to, but ships no term model — the
 * Blog module's `post_categories` and `post_tags` are bespoke tables
 * per taxonomy. We can't scaffold a per-taxonomy table for every
 * admin-created taxonomy without swimming against Laravel's static
 * migration model, so these two tables carry every dynamic-type term.
 *
 * `keystone_dynamic_content_terms` — one row per term. The taxonomy
 * slug lives on the row (no FK — filter-registered taxonomies have no
 * DB id), keeping admin- and code-registered taxonomies on the same
 * table.
 *
 * `keystone_dynamic_content_term_assignments` — record ↔ term pivot,
 * keyed by the content type slug and the numeric record id inside
 * that type's own table. We can't `FK constrained(...)` because the
 * target table changes per row, so integrity is soft-tied and
 * enforced by the controller.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('keystone_dynamic_content_terms', function (Blueprint $table): void {
            $table->id();
            $table->string('taxonomy_slug')->index();
            $table->string('name');
            $table->string('slug');
            // Self-referencing FK via ->constrained() blows up during
            // the CREATE (the table doesn't exist yet from MySQL's POV).
            // Application-side nullOnDelete would be nice; skip the FK
            // and rely on the application to null orphaned parents.
            $table->unsignedBigInteger('parent_id')->nullable()->index();
            $table->timestamps();

            $table->unique(['taxonomy_slug', 'slug']);
        });

        Schema::create('keystone_dynamic_content_term_assignments', function (Blueprint $table): void {
            $table->id();
            $table->string('content_type_slug');
            $table->unsignedBigInteger('record_id');
            $table->foreignId('term_id')->constrained('keystone_dynamic_content_terms')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(
                ['content_type_slug', 'record_id', 'term_id'],
                'keystone_dc_term_asn_unique',
            );
            // Custom name: the auto-generated `keystone_dynamic_content_
            // term_assignments_content_type_slug_record_id_index` blows
            // past MySQL's 64-character identifier limit.
            $table->index(['content_type_slug', 'record_id'], 'keystone_dc_term_asn_record_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('keystone_dynamic_content_term_assignments');
        Schema::dropIfExists('keystone_dynamic_content_terms');
    }
};
