<?php

declare(strict_types=1);

namespace App\Models;

use App\Support\ContentEdit\EditorPanels;
use Database\Factories\UserEditorPreferenceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single user's editor layout preferences for one post type.
 *
 * Screen Options (issue #189) owns `hidden_panels`; the drag / keyboard
 * reorder work (issue #190) owns `panel_order` and `collapsed_panels`.
 * All three are written through the same endpoint and hydrated through
 * {@see payloadFor()}.
 *
 * @property int $id
 * @property int $user_id
 * @property string $post_type
 * @property array<string, list<string>> $panel_order
 * @property list<string> $collapsed_panels
 * @property list<string> $hidden_panels
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class UserEditorPreference extends Model
{
    /** @use HasFactory<UserEditorPreferenceFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'post_type',
        'panel_order',
        'collapsed_panels',
        'hidden_panels',
    ];

    /**
     * Shape the editor preferences the given user has saved for a post
     * type into the payload the admin edit screens hydrate from, falling
     * back to the shipped defaults when they have no row yet so the
     * frontend never has to special-case a first-time editor.
     *
     * Stored ids are re-filtered on read: a panel removed from
     * {@see EditorPanels} between the write and this read would otherwise
     * ship an id the frontend registry can't resolve.
     *
     * @return array{
     *     post_type: string,
     *     hidden_panels: list<string>,
     *     collapsed_panels: list<string>,
     *     panel_order: array{main: list<string>, sidebar: list<string>},
     * }
     */
    public static function payloadFor(?User $user, string $postType): array
    {
        $preference = null === $user
            ? null
            : static::query()
                ->where('user_id', $user->id)
                ->where('post_type', $postType)
                ->first();

        return static::payloadForPreference($postType, $preference);
    }

    /**
     * The canonical payload shape for one (already-resolved) preference
     * row, or for a user who has none.
     *
     * Single source of truth for the contract the edit screens hydrate
     * from and every editor-preferences endpoint returns — see
     * `resources/js/lib/admin/editorPreferencesApi.ts` for the mirrored
     * TypeScript.
     *
     * A missing row yields the shipped defaults rather than three empty
     * lists: an empty `panel_order` does mean "every panel unplaced" (the
     * client resolves that to the default sidebar order), but an empty
     * `collapsed_panels` would wrongly mean "every panel open". That is the
     * one slice needing an explicit no-row branch — {@see EditorPanels::filter()}
     * takes `mixed` and maps null to an empty list, so the others don't.
     *
     * Every stored list is re-filtered on the way out, so a row carrying an
     * id the editor no longer offers — a retired panel, or `publish`, which
     * is orderable but never hideable or collapsible — can't reach the
     * client.
     *
     * @return array{
     *     post_type: string,
     *     hidden_panels: list<string>,
     *     collapsed_panels: list<string>,
     *     panel_order: array{main: list<string>, sidebar: list<string>},
     * }
     */
    public static function payloadForPreference(string $postType, ?self $preference): array
    {
        return [
            'post_type'        => $postType,
            'hidden_panels'    => EditorPanels::filter($preference?->hidden_panels),
            'collapsed_panels' => null === $preference
                ? EditorPanels::defaultCollapsedIds()
                : EditorPanels::filter($preference->collapsed_panels),
            'panel_order'      => EditorPanels::filterOrder($preference?->panel_order),
        ];
    }

    /**
     * The user these preferences belong to.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'panel_order'      => 'array',
            'collapsed_panels' => 'array',
            'hidden_panels'    => 'array',
        ];
    }
}
