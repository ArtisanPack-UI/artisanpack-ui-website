<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Deferred, mutex-guarded config-cache rebuild.
 *
 * Both Settings → Privacy and Settings → Performance mutate `.env` and
 * need the compiled `bootstrap/cache/config.php` to be regenerated when
 * the app is running against a cached config — otherwise the next
 * request boots against stale env-derived values. Two problems get
 * solved here in one place:
 *
 *   1. Latency: `Artisan::call('config:cache')` on a large install
 *      takes 200–800ms. Running it synchronously inside the admin's
 *      save round-trip makes every settings change feel slow.
 *      `app()->terminating()` defers the call until after the response
 *      is flushed to the browser.
 *
 *   2. Concurrency: Laravel's `ConfigCacheCommand` writes to
 *      `bootstrap/cache/config.php` via `Filesystem::put($path,
 *      $contents, false)` — no `LOCK_EX`. Two overlapping saves (or
 *      one save + a scheduled `config:cache` from another operator
 *      action) can therefore both write to the same file at once and
 *      produce a corrupt config cache. A shared cache-driver lock
 *      around the rebuild call coalesces them: whichever save arrives
 *      first rebuilds; the second one either waits and returns
 *      quickly, or (if the first is still running) skips because the
 *      values it wanted written are already reflected in the
 *      in-process config repository via `config()->set()`.
 */
final class DeferredConfigCacheRebuild
{
    /**
     * Cache lock key. Global to the app so both privacy and performance
     * save paths coalesce onto the same mutex, and single across
     * horizontally scaled workers when the cache driver is not
     * `array`/`file` (Redis, Memcached).
     *
     * @var string
     */
    private const LOCK_KEY = 'keystone:config-cache-rebuild';

    /**
     * Lock TTL in seconds. Longer than the worst-case
     * `config:cache` time we've seen on a large install (~1s), short
     * enough that a crashed worker's stale lock releases quickly.
     *
     * @var int
     */
    private const LOCK_TTL = 10;

    /**
     * Register a terminating callback that rebuilds the config cache
     * once the response is flushed, under a mutex to coalesce
     * overlapping saves. Safe to call multiple times per request — the
     * inner `Cache::lock()->get(callable)` is a try-once acquire, so
     * concurrent registrations across workers coalesce naturally.
     *
     * @since 1.0.0
     */
    public static function schedule(): void
    {
        app()->terminating(static function (): void {
            try {
                // `Cache::lock()->get(callable)` returns whatever the
                // callable returns (or true if it returned void) on
                // successful acquisition, and `false` if the lock was
                // already held. That's the semantics we want: the
                // goal is coalescing overlapping saves, not serialising
                // them. If another worker is already rebuilding, our
                // in-process `config()->set(...)` calls have already
                // reflected the change for the current + redirected
                // response, so a skipped rebuild here just means the
                // concurrent one will land the same values. The next
                // save (or scheduled operator action) can always
                // re-trigger.
                $acquired = Cache::lock(self::LOCK_KEY, self::LOCK_TTL)->get(static function (): void {
                    Artisan::call('config:cache');

                    // Emit only when this worker actually rebuilt — a
                    // skipped acquire means someone else fired (or will).
                    doAction('keystone.admin.settings.configCacheRebuilt');
                });

                if (false === $acquired) {
                    Log::debug('keystone: config-cache rebuild skipped (another worker holds the lock)');
                }
            } catch (Throwable $e) {
                // Never let a rebuild failure break the after-response
                // cycle. Log so an operator can see the mismatch, but
                // stale-config on the next boot is preferable to a
                // crashed terminator.
                Log::warning('keystone: deferred config:cache rebuild failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
