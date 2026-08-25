<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add the editor chrome `view_mode` to `user_editor_preferences` (issue #239).
 *
 * One value per (user, post type) alongside the panel layout already stored
 * here: `normal`, `full-width`, or `distraction-free`. A plain string with a
 * `normal` default rather than a JSON column — it is a single scalar, not a
 * set, and {@see \App\Support\ContentEdit\EditorViewModes::normalize()} maps
 * anything unrecognised back to the default on read, so an out-of-range value
 * can never reach the client.
 *
 * The `normal` default is what makes this additive: every existing row (and
 * every INSERT that predates the view-mode switcher) reads back as the
 * shipped layout with no backfill.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_editor_preferences', function (Blueprint $table): void {
            $table->string('view_mode', 32)
                ->default('normal')
                ->after('hidden_panels');
        });
    }

    public function down(): void
    {
        Schema::table('user_editor_preferences', function (Blueprint $table): void {
            $table->dropColumn('view_mode');
        });
    }
};
