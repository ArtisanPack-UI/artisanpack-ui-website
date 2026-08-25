<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\Concerns;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * Shared publication contract for admin editors (#187). The Post and
 * Page editors both need the same `published_at` validation and the
 * same rules for turning a validated payload back into attribute
 * values the framework's manager will accept, so hoist them here to
 * keep the scheduling contract in one spot.
 *
 * Stays central rather than moving into the Blog module with `PostController`
 * (#211) or the Pages module with `PageController` (#212): the scheduling state
 * machine is one contract that must not fork in two. Same call the Auth module
 * made for `App\Http\Requests\Concerns\NormalizesUsername` (#207) — a concern
 * shared by two modules belongs to neither.
 * `Modules\Blog\Http\Controllers\PostController` and
 * `Modules\Pages\Http\Controllers\PageController` therefore both import it
 * across the boundary, and will keep doing so.
 *
 * Between them, {@see publishedAtRules()} and {@see resolvePublication()}
 * make the backend the same state machine the Publish panel runs
 * client-side:
 *
 * - Scheduled needs a future date — but only when the author actually
 *   picks a new one.
 * - Published always ends up with a timestamp.
 * - Published + a future date is Scheduled, not Published.
 */
trait HandlesPublication
{
    /**
     * Validation rules for `published_at`. Scheduled rows require a
     * future date; every other status accepts any parseable value or
     * a null (so authors can backdate a published post).
     *
     * Uses a single `Rule::when` branch rather than layering
     * `nullable` with a conditional `required` — the two contradict
     * each other because `nullable` short-circuits any subsequent
     * `required` when the value is null, which would let a Scheduled
     * payload sneak through without a date.
     *
     * `$existing` relaxes the future-date requirement for a scheduled
     * record whose date has already passed. The scheduled-publish worker
     * runs every minute, so there is always a window — and after a cron
     * outage, potentially a long one — in which a row still says
     * `scheduled` with a date in the past. Without this, *every* edit to
     * such a record (fixing a typo, swapping the featured image) 422s on
     * a date field the author never touched, and the only way out is to
     * manually re-pick a future time. Submitting a genuinely new date
     * still has to be in the future.
     */
    protected function publishedAtRules(Request $request, ?Model $existing = null): \Illuminate\Validation\ConditionalRules
    {
        $isScheduled = ContentStatus::Scheduled->value === $request->input('status');

        if ($isScheduled && $this->publishedAtUnchanged($request, $existing)) {
            $isScheduled = false;
        }

        return Rule::when(
            $isScheduled,
            ['required', 'date', 'after:now'],
            ['nullable', 'date'],
        );
    }

    /**
     * Turn the validated payload into the `status` + `published_at`
     * attributes we hand the framework manager.
     *
     * An omitted `published_at` key must map to "leave the persisted
     * timestamp alone" — passing `null` here would fill the fillable
     * column with null and clobber the existing value on already-
     * published rows.
     *
     * Two coercions happen on top of that pass-through:
     *
     * 1. **Published with no date → now().** The manager only stamps
     *    `published_at` on the *transition* into Published, so clearing
     *    the date on an already-live record left it null — and every
     *    public post query requires a non-null date, so the post
     *    disappeared from the site while the admin still showed
     *    "Published". `now()` also matches what the UI's "Immediately"
     *    wording promises.
     * 2. **Published with a future date → Scheduled.** Left alone, this
     *    combination behaved oppositely for the two content types: a
     *    future-dated published post was invisible (posts are
     *    date-gated) while a future-dated published page was live
     *    immediately. Coercing the status makes the backend agree with
     *    the Publish panel's own Ghost-pattern auto-flip and erases the
     *    post/page drift. Backdating stays allowed.
     *
     * @param  array<string,mixed>  $validated
     * @param  Model|null  $existing  Persisted record, so the future-date
     *                                check can see the effective date even when the payload
     *                                omitted the key.
     *
     * @return array{status: string, published_at?: string|null}
     */
    protected function resolvePublication(array $validated, ?Model $existing = null): array
    {
        $status = (string) $validated['status'];
        $hasKey = array_key_exists('published_at', $validated);

        $submitted = $hasKey ? $this->parseDate($validated['published_at']) : null;
        $effective = $hasKey ? $submitted : $this->persistedPublishedAt($existing);

        $attributes = [];

        if ($hasKey) {
            $attributes['published_at'] = $submitted?->toDateTimeString();
        }

        if (ContentStatus::Published->value === $status) {
            if (null === $effective) {
                $attributes['published_at'] = Carbon::now()->toDateTimeString();
            } elseif ($effective->isFuture()) {
                $status = ContentStatus::Scheduled->value;
            }
        }

        $attributes['status'] = $status;

        return $attributes;
    }

    /**
     * Whether the submitted `published_at` is the same moment the record
     * already carries.
     *
     * Compared at minute granularity rather than exactly: the Publish
     * panel renders the date through `<input type="datetime-local">`,
     * which has no seconds component, so a value the author never touched
     * still round-trips with its seconds zeroed. An exact comparison
     * would read that truncation as a deliberate edit and re-arm the
     * `after:now` rule this method exists to relax.
     */
    private function publishedAtUnchanged(Request $request, ?Model $existing): bool
    {
        // Narrow the relaxation to the case it exists for: a record that is
        // ALREADY scheduled and whose date has slipped into the past while
        // waiting for the sweep. A draft carrying a pencilled-in past date
        // being scheduled for the first time is a genuine "pick a future
        // time" error and must still be rejected — otherwise this would be
        // a hole in the scheduling contract rather than a grace period
        // inside it.
        if (null === $existing
            || ContentStatus::Scheduled !== $existing->getAttribute('status')) {
            return false;
        }

        $persisted = $this->persistedPublishedAt($existing);

        if (null === $persisted) {
            return false;
        }

        /** @var mixed $submitted */
        $submitted = $request->input('published_at');

        if (! is_string($submitted) || '' === $submitted) {
            return false;
        }

        $parsed = $this->parseDate($submitted);

        if (null === $parsed) {
            return false;
        }

        return $parsed->startOfMinute()->equalTo($persisted->copy()->startOfMinute());
    }

    private function persistedPublishedAt(?Model $existing): ?CarbonInterface
    {
        /** @var mixed $value */
        $value = $existing?->getAttribute('published_at');

        return $value instanceof CarbonInterface ? $value : null;
    }

    /**
     * Parse a validated date value into a Carbon instance, or null when
     * the value is null. Validation has already run `date`, so a parse
     * failure here would be a programming error rather than user input —
     * but the catch keeps a surprising driver value from 500ing a save.
     */
    private function parseDate(mixed $value): ?CarbonInterface
    {
        if (null === $value || '' === $value) {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value;
        }

        try {
            return Carbon::parse((string) $value);
        } catch (Throwable) {
            return null;
        }
    }
}
