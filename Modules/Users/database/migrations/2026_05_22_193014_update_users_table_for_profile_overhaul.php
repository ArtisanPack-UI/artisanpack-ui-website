<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Overhaul the `users` table identity columns for the WordPress-style user
 * profile model (see issue #70).
 *
 * Adds `first_name`, `last_name`, `username`, `nickname`, `display_name`, and a
 * `profile_photo_id` foreign key onto `media`; backfills every existing row
 * from the old `name` column (split on the first space) and the email
 * local-part (deduplicated for the unique `username` index); then drops
 * `name`. Every reader of `users.name` switches to `display_name` in the same
 * change set.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('first_name')->nullable()->after('id');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('username')->nullable()->after('last_name');
            $table->string('nickname')->nullable()->after('username');
            $table->string('display_name')->nullable()->after('nickname');
            $table->foreignId('profile_photo_id')
                ->nullable()
                ->after('display_name')
                ->constrained('media')
                ->nullOnDelete();
        });

        $this->backfill();

        Schema::table('users', function (Blueprint $table): void {
            $table->string('username')->nullable(false)->change();
            $table->string('display_name')->nullable(false)->change();
            $table->unique('username');
            $table->dropColumn('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('name')->nullable()->after('id');
        });

        // Best-effort restore: recombine first/last name back into `name`,
        // falling back to display_name or username so the column is never
        // empty for existing rows. `lazyById()` streams rows in 1000-row
        // chunks rather than buffering the full table.
        foreach (DB::table('users')->orderBy('id')->lazyById() as $row) {
            $combined = trim(($row->first_name ?? '').' '.($row->last_name ?? ''));

            DB::table('users')->where('id', $row->id)->update([
                'name' => '' !== $combined
                    ? $combined
                    : ($row->display_name ?: $row->username),
            ]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->string('name')->nullable(false)->change();

            $table->dropForeign(['profile_photo_id']);
            $table->dropUnique(['username']);
            $table->dropColumn([
                'first_name',
                'last_name',
                'username',
                'nickname',
                'display_name',
                'profile_photo_id',
            ]);
        });
    }

    /**
     * Backfill the new identity columns for existing users. Splits `name` on
     * the first space (first word → `first_name`, remainder → `last_name`),
     * derives `username` from the email local-part (deduplicated on collision
     * with `-2`, `-3`, … suffixes), and uses the old `name` as the default
     * `display_name` so existing bylines render unchanged on the public site.
     */
    private function backfill(): void
    {
        $taken = [];

        // `lazyById()` streams rows in 1000-row chunks via cursor pagination
        // so large `users` tables don't get buffered in memory.
        foreach (DB::table('users')->orderBy('id')->lazyById() as $row) {
            $name      = (string) ($row->name ?? '');
            $parts     = preg_split('/\s+/', trim($name), 2) ?: [];
            $firstName = $parts[0] ?? '';
            $lastName  = $parts[1] ?? '';

            $base     = $this->slugifyEmailLocalPart((string) $row->email);
            $username = $this->uniqueUsername($base, $taken);

            $display = '' !== trim($name) ? trim($name) : $username;

            DB::table('users')->where('id', $row->id)->update([
                'first_name'   => '' !== $firstName ? $firstName : null,
                'last_name'    => '' !== $lastName ? $lastName : null,
                'username'     => $username,
                'display_name' => $display,
            ]);
        }
    }

    /**
     * Maximum username length the application-level validation enforces.
     * Mirrors the `max:60` rule on every FormRequest that accepts `username`
     * (Admin Store/Update, Auth/Register, Settings/Profile) so the
     * migration's backfill never produces rows that fail later validation.
     */
    private const USERNAME_MAX_LENGTH = 60;

    /**
     * Derive a username candidate from an email local-part. Lower-cases the
     * input, strips characters that aren't allowed by the application-level
     * username rule (letters, numbers, dot, hyphen, underscore), truncates to
     * {@see self::USERNAME_MAX_LENGTH} so the migrated row can still be saved
     * through the app, and falls back to `user` when the local-part is
     * missing or fully stripped.
     */
    private function slugifyEmailLocalPart(string $email): string
    {
        $local = (string) Str::before($email, '@');
        $local = Str::lower($local);
        $local = preg_replace('/[^a-z0-9._-]+/', '', $local) ?? '';
        $local = Str::substr($local, 0, self::USERNAME_MAX_LENGTH);

        return '' !== $local ? $local : 'user';
    }

    /**
     * Return a unique username built on `$base`, suffixing `-2`, `-3`, … on
     * collision against either the in-memory `$taken` set (other rows
     * processed in this pass) or the live `users.username` column.
     *
     * The suffix reserves its own space inside {@see self::USERNAME_MAX_LENGTH}
     * by trimming `$base` before appending so the final string still passes
     * the runtime `max:60` validation.
     *
     * @param  array<string, true>  $taken
     */
    private function uniqueUsername(string $base, array &$taken): string
    {
        $candidate = Str::substr($base, 0, self::USERNAME_MAX_LENGTH);
        $suffix    = 2;

        while (isset($taken[$candidate]) || DB::table('users')->where('username', $candidate)->exists()) {
            $marker        = '-'.$suffix;
            $trimmedBase   = Str::substr($base, 0, self::USERNAME_MAX_LENGTH - strlen($marker));
            $candidate     = $trimmedBase.$marker;
            $suffix++;
        }

        $taken[$candidate] = true;

        return $candidate;
    }
};
