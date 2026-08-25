<?php

declare(strict_types=1);

namespace Modules\Users\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Support\ContentEdit\EditorPanels;
use App\Support\ContentEdit\EditorViewModes;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Modules\Users\Models\UserEditorPreference;

/**
 * Per-user editor layout preferences for the post / page edit screens:
 * panel visibility from the Screen Options dropdown (issue #189), and
 * panel order plus collapse state from drag / keyboard reordering
 * (issue #190).
 *
 * Every write is a full replacement of the keys it carries rather than a
 * per-panel patch: the editor always knows the complete state for the post
 * type, so replacing it lets a dropped request self-heal on the next
 * change instead of leaving a half-applied diff.
 *
 * `hidden_panels` is required on every write; `panel_order` and
 * `collapsed_panels` are optional and columns absent from the request are
 * left untouched, so a client that only knows about visibility can't wipe
 * a layout it never rendered.
 *
 * Both endpoints answer with {@see UserEditorPreference::payloadForPreference()}
 * — the same shape the edit screens hydrate from, so the client can adopt
 * a response verbatim.
 */
class EditorPreferenceController extends Controller
{
    /**
     * Filter that widens the post-type allowlist beyond the two built-in
     * editors. Core seeds `['posts', 'pages']`; a module contributes its own
     * slugs from its own provider rather than core reaching into it — the
     * same core↔module seam as {@see \App\Support\SettingsPanels::FILTER}.
     * The generic dynamic-content editor (issue #239) registers every
     * persisted content-type slug here from
     * {@see \Modules\ContentModel\Providers\ContentModelServiceProvider}, so
     * its per-content-type view mode persists through the same store.
     */
    protected const POST_TYPES_FILTER = 'keystone.admin.editorPreferences.postTypes';

    /**
     * The base post types whose edit screen persists editor preferences,
     * before the {@see POST_TYPES_FILTER} widening. Validated on the route
     * parameter so a typo'd or plugin-invented slug can't seed preference
     * rows that nothing ever reads.
     *
     * @var list<string>
     */
    protected const BASE_POST_TYPES = ['posts', 'pages'];

    /**
     * PUT `/admin/editor-preferences/{postType}` — replace the calling
     * user's saved layout for this post type.
     */
    public function update(Request $request, string $postType): JsonResponse
    {
        $validated = $this->validateRequest($request, $postType, [
            'hidden_panels'         => ['present', 'array'],
            'hidden_panels.*'       => ['string', 'max:191'],
            'collapsed_panels'      => ['sometimes', 'array'],
            'collapsed_panels.*'    => ['string', 'max:191'],
            'panel_order'           => ['sometimes', 'array'],
            'panel_order.main'      => ['sometimes', 'array'],
            'panel_order.main.*'    => ['string', 'max:191'],
            'panel_order.sidebar'   => ['sometimes', 'array'],
            'panel_order.sidebar.*' => ['string', 'max:191'],
        ]);

        // Unknown ids are dropped rather than rejected — a panel retired
        // between a user's last visit and this write would otherwise 422
        // a toggle the user can't diagnose.
        $attributes = ['hidden_panels' => EditorPanels::filter($validated['hidden_panels'])];

        if (array_key_exists('collapsed_panels', $validated)) {
            $attributes['collapsed_panels'] = EditorPanels::filter($validated['collapsed_panels']);
        }

        if (array_key_exists('panel_order', $validated)) {
            $attributes['panel_order'] = EditorPanels::filterOrder($validated['panel_order']);
        }

        $key = [
            'user_id'   => $request->user()->id,
            'post_type' => $postType,
        ];

        $preference = $this->persist($key, $attributes);

        return response()->json(
            UserEditorPreference::payloadForPreference($postType, $preference),
        );
    }

    /**
     * PUT `/admin/editor-preferences/{postType}/view-mode` — persist just the
     * editor chrome view mode (issue #239).
     *
     * Its own endpoint rather than a key on {@see update()} for two reasons:
     * `update()` requires `hidden_panels` on every write and replaces the
     * keys it carries, so folding the mode into it would force the switcher
     * to resend the whole panel layout (and the layout hook to resend the
     * mode) — two independent writers clobbering each other's slice. This
     * write touches only `view_mode`; the panel columns are left untouched.
     *
     * The content-type editor has no panel layout at all, so this is the one
     * preferences write it ever makes — which is why the mode lives on its
     * own path both shells can share.
     */
    public function updateViewMode(Request $request, string $postType): JsonResponse
    {
        $validated = $this->validateRequest($request, $postType, [
            'view_mode' => ['required', Rule::in(EditorViewModes::MODES)],
        ]);

        $key = [
            'user_id'   => $request->user()->id,
            'post_type' => $postType,
        ];

        // Reuse the same create-only collapse-default seeding as update():
        // a user whose first-ever preference write is a mode switch must
        // still get the shipped default-collapsed set, not an empty list.
        $preference = $this->persist($key, ['view_mode' => $validated['view_mode']]);

        return response()->json(
            UserEditorPreference::payloadForPreference($postType, $preference),
        );
    }

    /**
     * DELETE `/admin/editor-preferences/{postType}` — the "Reset layout"
     * link. Drops the whole row so the shipped defaults apply again, which
     * is why it deletes rather than nulling one column: order, collapse
     * state, and visibility all reset together.
     */
    public function destroy(Request $request, string $postType): JsonResponse
    {
        $this->validateRequest($request, $postType);

        UserEditorPreference::query()
            ->where('user_id', $request->user()->id)
            ->where('post_type', $postType)
            ->delete();

        // With the row gone the payload is the shipped default layout,
        // which is exactly what a user who never saved anything receives —
        // so "Reset layout" and "first visit" agree by construction.
        return response()->json(
            UserEditorPreference::payloadForPreference($postType, null),
        );
    }

    /**
     * Write the preference row, seeding create-only defaults and retrying
     * once on a unique-index collision.
     *
     * Two things are going on here, and they interact:
     *
     * 1. **Create-only defaults.** On the row-creating write, an absent
     *    `collapsed_panels` would take the column's DB default of `[]` —
     *    which reads as "every panel open" and permanently discards the
     *    shipped default-collapsed set (Attributes, SEO).
     *    `payloadForPreference()` only substitutes the defaults when there
     *    is no row at all, so once a row exists there is nothing left to
     *    recover them from. `firstOrNew` + an `exists` check is what lets
     *    us apply that default to an INSERT and never to an UPDATE.
     * 2. **The race.** Two concurrent first-time writes for the same user
     *    and post type both see no row, and the loser's INSERT violates
     *    the `(user_id, post_type)` unique index — a 500 on a background
     *    preference save the user never asked for.
     *
     * The retry deliberately re-runs this whole method rather than
     * reusing the first attempt's attributes: by then the winner's row
     * exists, so the create-only default must NOT be applied again. Doing
     * so would overwrite an explicit `collapsed_panels` the winner had
     * just set with the shipped defaults.
     *
     * Catch-and-retry rather than `upsert()`: `upsert` bypasses the array
     * casts on this model, so the JSON columns would be written as PHP
     * arrays the driver can't bind.
     *
     * @param  array<string, mixed>  $key
     * @param  array<string, mixed>  $attributes
     */
    protected function persist(array $key, array $attributes, bool $isRetry = false): UserEditorPreference
    {
        $preference = UserEditorPreference::query()->firstOrNew($key);

        // Kept separate from `$attributes` so the retry below re-derives
        // the default from the post-race state instead of carrying this
        // attempt's INSERT-shaped payload into an UPDATE.
        $writable = $attributes;

        if (! $preference->exists && ! array_key_exists('collapsed_panels', $writable)) {
            $writable['collapsed_panels'] = EditorPanels::defaultCollapsedIds();
        }

        $preference->fill($writable);

        try {
            $preference->save();
        } catch (UniqueConstraintViolationException $e) {
            if ($isRetry) {
                throw $e;
            }

            return $this->persist($key, $attributes, isRetry: true);
        }

        return $preference;
    }

    /**
     * Validate the `{postType}` route parameter alongside any body rules.
     *
     * The parameter is merged into the request so a bad slug surfaces as
     * a normal 422 keyed to `post_type` rather than the 404 a route
     * constraint would produce.
     *
     * @param  array<string, list<string>>  $rules
     *
     * @return array<string, mixed>
     */
    protected function validateRequest(Request $request, string $postType, array $rules = []): array
    {
        $request->merge(['post_type' => $postType]);

        return $request->validate(array_merge(
            ['post_type' => ['required', Rule::in($this->allowedPostTypes())]],
            $rules,
        ));
    }

    /**
     * The post types this controller will persist preferences for: the two
     * built-in editors plus whatever a module contributes through
     * {@see POST_TYPES_FILTER}. Non-string and duplicate entries a subscriber
     * returns are dropped so a malformed filter can't widen the allowlist to
     * junk — the same defensive posture as {@see \App\Support\SettingsPanels}.
     *
     * @return list<string>
     */
    protected function allowedPostTypes(): array
    {
        $types = static::BASE_POST_TYPES;

        if (function_exists('applyFilters')) {
            /** @var mixed $filtered */
            $filtered = applyFilters(static::POST_TYPES_FILTER, $types);

            if (is_array($filtered)) {
                $types = array_values(array_filter(
                    $filtered,
                    static fn (mixed $type): bool => is_string($type) && '' !== $type,
                ));
            }
        }

        return array_values(array_unique([...static::BASE_POST_TYPES, ...$types]));
    }
}
