<?php

declare(strict_types=1);

namespace App\Support\ContentEdit;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentEditExtensions;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use stdClass;

/**
 * Bridges the cms-framework `ContentEditExtensions` manager (the
 * `ap.cmsFramework.admin.contentEdit.*` filter registry) into the shape the admin
 * edit screens expose to React. Plugins register panels/tabs/blocks
 * through the framework filter; Keystone reads them here and passes
 * them as an Inertia prop so the `<AdminEditSlot>` component can pick
 * up the right entries for each slot position.
 */
class PanelSlotSupport
{
    /**
     * Position values a panel entry can declare. Anything else is
     * coerced to `default` in {@see normalize()} so a plugin typo
     * (`sidebartop`) or an unknown custom value can never route the
     * panel into a nonexistent slot on the client.
     */
    protected const ALLOWED_POSITIONS = ['top', 'bottom', 'default'];

    /**
     * Build the `contentEdit` payload the edit screen shares with the
     * client. Content type + record are passed through to the filters
     * so plugin authors can gate their panels by content type or by
     * record shape (e.g. only render for pages under a specific parent).
     *
     * @return array{
     *     panels: list<array<string, mixed>>,
     *     tabs: list<array<string, mixed>>,
     *     beforeEditor: list<array<string, mixed>>,
     *     afterEditor: list<array<string, mixed>>,
     * }
     */
    public static function payload(string $contentType, ?Model $record = null): array
    {
        $extensions = app(ContentEditExtensions::class);
        $context    = static::context($contentType, $record);

        return [
            'panels'       => static::normalize($extensions->panels($context)),
            'tabs'         => static::normalize($extensions->tabs($context)),
            'beforeEditor' => static::normalize($extensions->beforeEditor($context)),
            'afterEditor'  => static::normalize($extensions->afterEditor($context)),
        ];
    }

    /**
     * Run a save payload through the `ap.cmsFramework.admin.contentEdit.saveData`
     * filter so plugin panels can wash, annotate, or reject fields
     * before the host persists them. Called on the VALIDATED payload
     * (after `$request->validate()`) so a misbehaving plugin filter
     * cannot silently drop a required host field like `title` or
     * `slug` and surface it as a confusing validation error against
     * text the admin actually submitted.
     *
     * @param  array<string, mixed>  $data
     *
     * @return array<string, mixed>
     */
    public static function filterSave(string $contentType, array $data, ?Model $record = null): array
    {
        return app(ContentEditExtensions::class)->saveData(
            $data,
            static::context($contentType, $record),
        );
    }

    /**
     * @return array<string, mixed>
     */
    protected static function context(string $contentType, ?Model $record): array
    {
        return [
            'contentType' => $contentType,
            'record'      => $record,
            'recordId'    => $record?->getKey(),
        ];
    }

    /**
     * Reduce each framework-shaped entry into a payload the React slot
     * component can render without needing to know about the filter's
     * looser internal shape.
     *
     * Rejects entries missing `slug` / `component`, coerces unknown
     * `position` values to `default` (with a warning log so plugin
     * authors can spot the typo), and walks `props` recursively to
     * strip any non-JSON-safe leaf (Closures, resources, Eloquent
     * models) — one such leaf otherwise blows up `json_encode` and
     * 500s every edit-screen render for every viewer.
     *
     * Federated remotes may attach their loader coordinates directly on
     * the entry so the client-side loader can resolve the module
     * without a second lookup.
     *
     * @param  list<array<string, mixed>>  $entries
     *
     * @return list<array<string, mixed>>
     */
    protected static function normalize(array $entries): array
    {
        $out = [];

        foreach ($entries as $entry) {
            if (! isset($entry['slug'], $entry['component'])) {
                continue;
            }

            $position     = isset($entry['position']) ? (string) $entry['position'] : 'default';
            $safePosition = in_array($position, self::ALLOWED_POSITIONS, true) ? $position : 'default';

            if ($safePosition !== $position) {
                Log::warning('Content-edit panel declared unknown position; coerced to "default".', [
                    'slug'     => $entry['slug'],
                    'position' => $position,
                ]);
            }

            $normalized = [
                'slug'      => (string) $entry['slug'],
                'title'     => isset($entry['title']) ? (string) $entry['title'] : null,
                'component' => (string) $entry['component'],
                'position'  => $safePosition,
                'order'     => (int) ($entry['order'] ?? 50),
                'props'     => static::sanitizeProps($entry['props'] ?? null),
            ];

            if (isset($entry['remote'], $entry['entry'], $entry['module'])) {
                $normalized['remote'] = (string) $entry['remote'];
                $normalized['entry']  = (string) $entry['entry'];
                $normalized['module'] = (string) $entry['module'];
            }

            $out[] = $normalized;
        }

        return $out;
    }

    /**
     * Recursively strip anything `json_encode` can't handle from a
     * panel's `props`. Scalars, nulls, and nested arrays pass through;
     * Closures, resources, objects (Eloquent models, DateTimeImmutable
     * from carbon, etc.) get dropped. Returns `stdClass` when the
     * result is empty so Inertia serializes as `{}` not `[]`.
     */
    protected static function sanitizeProps(mixed $props): array|stdClass
    {
        if (! is_array($props) || [] === $props) {
            return new stdClass;
        }

        $clean = [];
        foreach ($props as $key => $value) {
            $safe = static::sanitizeLeaf($value);
            if (null !== $safe || null === $value) {
                $clean[$key] = $safe;
            }
        }

        return [] === $clean ? new stdClass : $clean;
    }

    /**
     * Coerce a single leaf value into something json_encode accepts.
     * Returns null when the value can't be safely serialized so the
     * caller can drop the key entirely.
     */
    protected static function sanitizeLeaf(mixed $value): mixed
    {
        if (null === $value || is_scalar($value)) {
            return $value;
        }

        if (is_array($value)) {
            $clean = [];
            foreach ($value as $key => $inner) {
                $safe = static::sanitizeLeaf($inner);
                if (null !== $safe || null === $inner) {
                    $clean[$key] = $safe;
                }
            }

            return $clean;
        }

        // Closures, resources, Eloquent models, DateTime, generators —
        // none of these round-trip cleanly through `json_encode`. Drop.
        return null;
    }
}
