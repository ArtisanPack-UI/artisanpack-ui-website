<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Provenance for records tables provisioned by the Content Types admin UI.
 *
 * The admin form derives a table name from the content type's slug
 * (`case-study` → `case_studies`), and `ensureRecordsTable()` will happily
 * adopt — and ALTER — a table that already exists under that name. Slugs
 * like `user` or `medium` derive onto `users` and `media`, so the feature
 * could bolt `title`/`status`/`published_at` columns onto a core table and
 * then CRUD rows in it.
 *
 * Guarding on "does the table already exist?" alone isn't enough, because
 * deleting a content type hard-deletes its `content_types` row but
 * deliberately leaves the data table behind (it may hold user data) — so a
 * bare existence check would block the legitimate delete-then-recreate
 * flow. This table records which tables the feature itself created, which
 * is the distinction the guard actually needs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('keystone_content_type_tables', function (Blueprint $table): void {
            $table->id();
            // Unique: one owning content type per table. This is the index
            // that makes two slugs pluralizing to the same name
            // (`case-study` + `case-studies`) a detectable conflict rather
            // than a silent shared table.
            $table->string('table_name')->unique();
            $table->string('content_type_slug')->index();
            $table->timestamps();
        });

        $this->backfillExistingContentTypes();
    }

    public function down(): void
    {
        Schema::dropIfExists('keystone_content_type_tables');
    }

    /**
     * Claim the records table of every content type that already exists on
     * this install.
     *
     * Without the backfill, an upgraded site would treat all of its own
     * existing CPT tables as foreign and refuse to recreate any of them.
     * Rows whose table doesn't (yet) exist are skipped — a content type
     * whose migration hasn't run has nothing to claim.
     */
    private function backfillExistingContentTypes(): void
    {
        if (! Schema::hasTable('content_types')) {
            return;
        }

        $now = now();

        $rows = DB::table('content_types')
            ->select(['id', 'slug', 'table_name'])
            // Ordered so `unique('table_name')` below keeps the *oldest*
            // claimant when two rows already share a table. Without an
            // ORDER BY the winner is whatever the driver happens to return
            // first, which would make the backfill non-deterministic across
            // installs and re-runs.
            ->orderBy('id')
            ->get()
            // Both columns have to be usable: `content_type_slug` is what
            // the guard compares against, so a row claiming a table under
            // an empty slug would make that table permanently unclaimable.
            ->filter(fn ($row) => is_string($row->table_name)
                && '' !== $row->table_name
                && is_string($row->slug)
                && '' !== $row->slug
                && Schema::hasTable($row->table_name))
            // Two content types already sharing a table is exactly the bug
            // this migration exists to prevent; the unique index would
            // reject the second row, so keep the first and let the guard
            // handle the rest from here on.
            ->unique('table_name')
            ->map(fn ($row) => [
                'table_name'        => $row->table_name,
                'content_type_slug' => $row->slug,
                'created_at'        => $now,
                'updated_at'        => $now,
            ])
            ->values()
            ->all();

        if ([] !== $rows) {
            DB::table('keystone_content_type_tables')->insert($rows);
        }
    }
};
