<?php

declare(strict_types=1);

namespace App\Support\ContentModel;

use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Naming and ownership rules for the records tables the Content Types
 * admin UI provisions.
 *
 * The table name is derived from the slug so admins never have to reason
 * about the database. That convenience is also the hazard: `user` derives
 * onto `users` and `medium` onto `media`, and the provisioning step adopts
 * any table that already carries the derived name — adding `title`,
 * `status`, and `published_at` columns to it and then CRUDing rows through
 * the generic dynamic-content controller.
 *
 * {@see claimableBy()} is the gate that stops that. A table is available
 * to a slug when it doesn't exist yet, or when this feature created it for
 * that same slug previously (deleting a content type hard-deletes its
 * metadata row but leaves the data table standing, so delete-then-recreate
 * has to keep working). Ownership is tracked in
 * `keystone_content_type_tables` because `content_types` alone can't tell
 * "we made this" from "this is the users table".
 */
final class ContentTypeTables
{
    private const REGISTRY = 'keystone_content_type_tables';

    /**
     * Derive a snake_cased plural table name from a kebab-case slug.
     * `portfolio` → `portfolios`, `case-study` → `case_studies`.
     */
    public static function derive(string $slug): string
    {
        return Str::snake(Str::pluralStudly(Str::studly($slug)));
    }

    /**
     * Whether `$slug` may provision (or re-adopt) its derived table.
     *
     * False means the derived name belongs to something else — a core
     * table, a package's table, or another content type whose slug happens
     * to pluralize the same way (`case-study` and `case-studies` both
     * derive `case_studies`).
     */
    public static function claimableBy(string $slug): bool
    {
        $table = self::derive($slug);
        $owner = self::ownerSlug($table);

        if (null !== $owner) {
            return $owner === $slug;
        }

        // Unregistered but present on disk: not ours to touch.
        return ! Schema::hasTable($table);
    }

    /**
     * Record `$slug` as the owner of `$table`, returning whether it now
     * holds that ownership.
     *
     * This, not {@see claimableBy()}, is the authoritative check.
     * `claimableBy()` is a read, so two concurrent creates for slugs that
     * derive the same table (`case-study` and `case-studies`) both pass it
     * — neither sees the other's row, because neither has written one yet.
     * Letting the unique index arbitrate instead closes that window: the
     * INSERT is the claim, and exactly one of them can win it.
     *
     * Idempotent by the same mechanism — a type re-provisioning the table
     * it already owns collides with its own row and is told, correctly,
     * that it owns it.
     *
     * Returns true on installs whose registry migration hasn't run yet;
     * there is nothing to enforce against, and refusing every claim would
     * take the feature down entirely.
     */
    public static function claim(string $slug, string $table): bool
    {
        if (! Schema::hasTable(self::REGISTRY)) {
            return true;
        }

        try {
            DB::table(self::REGISTRY)->insert([
                'table_name'        => $table,
                'content_type_slug' => $slug,
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);

            return true;
        } catch (UniqueConstraintViolationException) {
            // Either we already owned it, or somebody else just took it.
            // Only the first is a success.
            return self::ownerSlug($table) === $slug;
        }
    }

    /**
     * The content type slug that provisioned `$table`, or null when this
     * feature never created it.
     */
    public static function ownerSlug(string $table): ?string
    {
        if (! Schema::hasTable(self::REGISTRY)) {
            return null;
        }

        /** @var mixed $slug */
        $slug = DB::table(self::REGISTRY)->where('table_name', $table)->value('content_type_slug');

        return is_string($slug) && '' !== $slug ? $slug : null;
    }
}
