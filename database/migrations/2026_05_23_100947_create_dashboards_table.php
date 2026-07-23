<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the `dashboards` table for the per-user customizable dashboard
 * system (see issue #71). Each row is one named dashboard owned by a user,
 * with the widget list serialized into a single JSON column instead of a
 * separate join table — see the parent issue for the design tradeoff.
 *
 * Slugs are unique per user (composite index on `user_id` + `slug`) so two
 * different users can each have an "overview" dashboard. The `is_default`
 * flag is intentionally not enforced at the DB layer; UserDashboardService
 * keeps a single default per user inside a transaction.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dashboards', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->boolean('is_default')->default(false);
            $table->unsignedInteger('position')->default(0);
            // MySQL 8+ and SQLite 3.38+ both require JSON defaults to be an
            // expression rather than a literal. `JSON_ARRAY()` is portable
            // across both — `->default('[]')` would parse-error on MySQL.
            $table->json('widgets')->default(new Expression('(JSON_ARRAY())'));
            $table->timestamps();

            $table->unique(['user_id', 'slug']);
            $table->index(['user_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dashboards');
    }
};
