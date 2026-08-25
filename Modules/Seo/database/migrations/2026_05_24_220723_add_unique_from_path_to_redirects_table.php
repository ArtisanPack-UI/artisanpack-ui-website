<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The SEO package's `2024_01_01_000003_create_redirects_table` migration
 * declared `from_path` as a plain index, not unique — so concurrent
 * writers could race past the controller's `unique:redirects,from_path`
 * validation and persist duplicates. Layer a real DB-level constraint
 * on top so the contract holds even when the app-layer check has a
 * race window or is bypassed (CLI seeders, console commands, future
 * APIs).
 *
 * Fails fast (with the offending paths) if legacy duplicates already
 * exist in the table — better than letting MySQL throw a generic
 * "duplicate key" mid-migration on a production deploy.
 */
return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('redirects')
            ->select('from_path')
            ->groupBy('from_path')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('from_path')
            ->all();

        if ([] !== $duplicates) {
            throw new RuntimeException(
                'Cannot add unique index on redirects.from_path: duplicate values exist for ['
                .implode(', ', array_map(static fn (string $p): string => '"'.$p.'"', $duplicates))
                .']. Resolve them (keep one row per path) and re-run the migration.'
            );
        }

        Schema::table('redirects', function (Blueprint $table): void {
            $table->unique('from_path', 'redirects_from_path_unique');
        });
    }

    public function down(): void
    {
        Schema::table('redirects', function (Blueprint $table): void {
            $table->dropUnique('redirects_from_path_unique');
        });
    }
};
