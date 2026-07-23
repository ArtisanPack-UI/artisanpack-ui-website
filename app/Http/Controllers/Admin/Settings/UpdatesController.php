<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\Settings;

use App\Http\Controllers\Controller;
use App\Services\UpdateNotifier;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Exceptions\UpdateException;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\Managers\ApplicationUpdateManager;
use ArtisanPackUI\CMSFramework\Modules\Core\Updates\ValueObjects\UpdateInfo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

/**
 * Settings > System > Updates — shows release status and triggers updates.
 *
 * Resolution path:
 *   - GET  /admin/settings/updates → render the Inertia page with the
 *     latest available release (cache-backed via UpdateChecker so we
 *     don't beat up the GitLab API on every dashboard visit).
 *   - POST /admin/settings/updates → run the framework's
 *     `ApplicationUpdateManager::performUpdate()`, then fan an in-app
 *     notification out to every admin (success or failure). The manager
 *     itself owns rollback on failure.
 *
 * Gated by `permission:updater.run` (seeded admin-only by
 * `KeystonePermissionsSeeder`) — see plans/06-keystone-plan.md §3.6.
 */
class UpdatesController extends Controller
{
    public function show(Request $request, ApplicationUpdateManager $manager): Response
    {
        $latest    = $this->fetchLatest($manager);
        $hasToken  = '' !== (string) config('keystone.updates.gitlab_access_token', '');
        $sourceUrl = (string) config('keystone.updates.source_url', '');
        $rawError  = null === $latest ? $this->lastCheckError($request) : null;
        $status    = $this->classifyStatus($latest, $rawError, $sourceUrl, $hasToken);

        return Inertia::render('admin/settings/Updates', [
            'updates' => [
                'current_version'  => (string) config('app.version', '0.0.0'),
                'latest_version'   => $latest?->latestVersion,
                'changelog'        => $latest?->changelog,
                'release_date'     => $latest?->releaseDate,
                'release_url'      => $latest?->metadata['release_url'] ?? null,
                'has_update'       => $latest?->hasUpdate() ?? false,
                'check_status'     => $status,
                'check_message'    => $this->statusMessage($status, $hasToken),
                'check_error'      => $rawError,
                'source_url'       => $sourceUrl,
                'strategy'         => (string) config('keystone.updates.strategy', 'release_asset'),
                'has_access_token' => $hasToken,
            ],
        ]);
    }

    public function update(Request $request, ApplicationUpdateManager $manager, UpdateNotifier $notifier): RedirectResponse
    {
        // Resolve the version that will *actually* be installed from the
        // manager, not from request input. `performUpdate()` re-checks
        // internally and applies whatever the source reports as latest,
        // so a stale or spoofed `version` field on the form would surface
        // wrong notifications. The submitted value is only used as a
        // tripwire — if it disagrees with the manager's view, refuse and
        // make the admin reload (the release feed has moved on).
        try {
            $latestInfo = $manager->checkForUpdate();
        } catch (Throwable $e) {
            return redirect()
                ->route('admin.settings.updates')
                ->with('error', 'Cannot run update: release feed unreachable. '.$e->getMessage());
        }

        $targetVersion = $latestInfo->latestVersion;
        $requested     = $request->string('version')->trim()->value();

        if ('' !== $requested && $requested !== $targetVersion) {
            return redirect()
                ->route('admin.settings.updates')
                ->with('error', "The requested version ({$requested}) no longer matches the latest available release ({$targetVersion}). Reload and try again.");
        }

        try {
            $manager->performUpdate();

            $notifier->notifySuccess($targetVersion);

            // Invalidate the cached "update available" flag so the
            // dashboard banner clears immediately rather than waiting
            // for the next scheduled tick.
            Cache::forget('cms.update_available');

            return redirect()
                ->route('admin.settings.updates')
                ->with('success', "Keystone updated to {$targetVersion}.");
        } catch (Throwable $e) {
            Log::error('Keystone update failed', [
                'target_version' => $targetVersion,
                'exception'      => $e->getMessage(),
            ]);

            $notifier->notifyFailure($targetVersion, $e->getMessage());

            return redirect()
                ->route('admin.settings.updates')
                ->with('error', 'Update failed: '.$e->getMessage().' The pre-update snapshot was restored.');
        }
    }

    /**
     * Best-effort check for the latest release.
     *
     * Network failures, missing config, or transient GitLab errors should
     * land on the page as a friendly check_error string rather than a
     * 500 — admins still need to be able to view the page to fix things.
     */
    private function fetchLatest(ApplicationUpdateManager $manager): ?UpdateInfo
    {
        try {
            return $manager->checkForUpdate();
        } catch (UpdateException|Throwable $e) {
            Log::warning('Keystone update check failed', [
                'exception' => $e->getMessage(),
            ]);

            request()->attributes->set('keystone.updates.check_error', $e->getMessage());

            return null;
        }
    }

    private function lastCheckError(Request $request): ?string
    {
        $message = $request->attributes->get('keystone.updates.check_error');

        return is_string($message) ? $message : null;
    }

    /**
     * Translate the framework's exception messages into a status the React
     * page can render with the right tone.
     *
     * The cms-framework's GitLabUpdateSource throws plain
     * `UpdateException::versionCheckFailed(...)` with an embedded string
     * for every distinct failure mode, so we have to substring-match.
     * Order matters — "auth" is checked before generic 404 because a
     * 404 on a private repo usually means "wrong token".
     *
     * @return 'error'|'no_releases'|'no_url'|'not_found'|'ok'|'unauthorized'
     */
    private function classifyStatus(?UpdateInfo $latest, ?string $error, string $sourceUrl, bool $hasToken): string
    {
        if (null !== $latest) {
            return 'ok';
        }

        if ('' === $sourceUrl) {
            return 'no_url';
        }

        $needle = strtolower((string) $error);

        if (str_contains($needle, 'no releases found') || str_contains($needle, 'no stable releases')) {
            return 'no_releases';
        }

        if (str_contains($needle, '401') || str_contains($needle, 'unauthorized')) {
            return 'unauthorized';
        }

        if (str_contains($needle, '403') || str_contains($needle, 'forbidden')) {
            return 'unauthorized';
        }

        // GitLab returns 404 in two distinct cases:
        //   - the project doesn't exist (caller has correct auth) → not_found
        //   - the project is private + caller is unauthenticated → unauthorized
        // We can't tell the two apart from the response alone, so we treat
        // 404 as an auth problem in both cases: with no token it's an
        // unauth'd hit on a private repo; with a token it's almost always
        // a bad/insufficient-scope token (the URL would have to be wrong
        // *and* the token valid — a small overlap that the rendered
        // message can still address via the `has_access_token` hint).
        if (str_contains($needle, '404') || str_contains($needle, 'not found')) {
            return 'unauthorized';
        }

        return 'error';
    }

    private function statusMessage(string $status, bool $hasToken): ?string
    {
        return match ($status) {
            'ok'           => null,
            'no_url'       => 'No update source is configured. Set UPDATE_SOURCE_URL in `.env` to enable update checks.',
            'no_releases'  => 'No releases have been published to GitLab yet. Tag and push a release on this repo and a new check will pick it up.',
            'unauthorized' => $hasToken
                ? 'GitLab rejected the access token. Verify GITLAB_ACCESS_TOKEN in `.env` has `read_api` scope and is a member of this project.'
                : 'GitLab returned 404. If the source repository is private, set GITLAB_ACCESS_TOKEN in `.env` with `read_api` scope.',
            'not_found'    => 'GitLab could not find the source repository. Double-check UPDATE_SOURCE_URL in `.env`.',
            default        => 'The release feed could not be reached. See the details below.',
        };
    }
}
