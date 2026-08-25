<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the `user_editor_preferences` table backing the editor's
 * per-user, per-post-type layout state (see issue #189 / #190).
 *
 * One row per (user, post type): Screen Options writes `hidden_panels`
 * today; `panel_order` and `collapsed_panels` are provisioned here so the
 * drag/keyboard reorder work in issue #190 lands as pure application code
 * rather than a second migration against a table that already shipped.
 *
 * `post_type` stores the admin resource slug (`posts`, `pages`, or a CPT
 * slug) rather than a foreign key — content types can be registered by
 * plugins at runtime and are not guaranteed to have a `content_types` row.
 * A stale slug therefore leaves an orphaned preference row that is simply
 * never read, which is preferable to a constraint that blocks plugin CPTs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_editor_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->string('post_type', 191);
            // MySQL 8+ and SQLite 3.38+ both require JSON defaults to be
            // an expression rather than a literal — see the `dashboards`
            // migration for the same note.
            $table->json('panel_order')->default(new Expression('(JSON_OBJECT())'));
            $table->json('collapsed_panels')->default(new Expression('(JSON_ARRAY())'));
            $table->json('hidden_panels')->default(new Expression('(JSON_ARRAY())'));
            $table->timestamps();

            // One preference row per user per post type. Screen Options
            // upserts against this pair on every visibility toggle.
            $table->unique(['user_id', 'post_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_editor_preferences');
    }
};
