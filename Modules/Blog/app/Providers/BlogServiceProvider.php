<?php

declare(strict_types=1);

namespace Modules\Blog\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Comment;
use Illuminate\Console\Scheduling\Schedule;
use Modules\Blog\Console\Commands\PublishScheduledContent;

/**
 * Boots the Blog module.
 *
 * Like Analytics, Auth, Users, Media and Forms, there was no
 * `app/Providers/*ServiceProvider.php` to absorb here (#211) — posts,
 * categories, tags and comments are all artisanpack-ui/cms-framework's Blog
 * module, which owns the models, the tables and their migrations and factories.
 * Keystone's module is the surface around it: the admin CRUD for posts and both
 * taxonomies, the public blog index and post detail rendering, the browser-form
 * comment submission endpoint, and the scheduled-publish sweep. So
 * `bootstrap/providers.php` is untouched by the extraction, and `database/` was
 * stripped from the generated scaffolding along with its two autoload entries
 * rather than committed empty — the same call Auth, Media and Forms made.
 *
 * Two hook registrations moved out of `App\Providers\AppServiceProvider::boot()`
 * and both are safe at this provider's earlier boot slot; see {@see boot()}.
 * Nothing here reads `SettingsManager`, so the §7 step-4 boot-order trap
 * (plans/14-modular-laravel-setup.md — a module provider now boots ahead of
 * `App\Providers\SettingsServiceProvider`, so `SettingsManager::getSetting()`
 * returns `null` for keys whose defaults have not been registered yet) does not
 * apply. The `discussion.*` settings the comment flow depends on are read
 * per-request inside `CommentSubmissionController`, long after every provider
 * has booted.
 */
class BlogServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Blog';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'blog';

    /**
     * Command classes to register.
     *
     * The command was auto-discovered from `app/Console/Commands` before the
     * move — Laravel's default command path, which does not extend into
     * `Modules/`. Listing it here restores discovery without changing the
     * `keystone:publish-scheduled` signature the schedule and the runbooks use.
     *
     * @var string[]
     */
    protected array $commands = [
        PublishScheduledContent::class,
    ];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    /**
     * Bootstrap the module.
     *
     * Registers the two comment hooks that used to live in
     * `App\Providers\AppServiceProvider::boot()`. Both are Blog-owned: one
     * points at a route this module now declares, the other switches on a
     * cms-framework Blog model constant.
     *
     * `comments.form.action` redirects the visual-editor
     * `artisanpack/post-comments-form` block away from cms-framework's JSON
     * `/api/v1/comments` endpoint and onto this module's `comments.store`
     * route, so a guest visitor gets the standard browser-form UX
     * (POST → 303 → GET with a flash message) instead of landing on raw JSON.
     * The block renderer reads it via
     * `applyFilters('comments.form.action', ...)`.
     *
     * Safe to register earlier in the provider chain than `AppServiceProvider`,
     * where both used to live. Filters are additive rather than
     * last-registration-wins, so the earlier slot could only matter if
     * something else registered on the same two hook names — nothing in the app
     * or in vendor does, and `route()` inside the closure is resolved lazily
     * when the block renders, not now, so the module's own route file has long
     * since been mapped by then.
     *
     * The `function_exists` guard is carried over verbatim from
     * `AppServiceProvider`: the hooks helpers come from artisanpack-ui/hooks
     * via composer `files` autoloading, and the guard keeps boot alive on an
     * install where that package is absent.
     */
    public function boot(): void
    {
        parent::boot();

        $this->registerScheduledPublishing();

        if (! function_exists('addFilter')) {
            return;
        }

        addFilter('comments.form.action', fn () => route('comments.store'));

        // Local-env convenience: auto-approve guest comments so the
        // submit-and-render flow is testable end-to-end without hopping
        // into the moderation queue. Production keeps the default
        // `pending` behavior and surfaces a moderation UI for approval.
        // `CommentSubmissionController` still forces `spam` on a
        // banned-words match, so this cannot upgrade a rejected comment.
        if ($this->app->environment('local')) {
            addFilter(
                'ap.cmsFramework.comments.store.defaultStatus',
                fn () => Comment::STATUS_APPROVED,
            );
        }
    }

    /**
     * Register the every-minute scheduled-publish sweep.
     *
     * Transcribed from `AppServiceProvider::registerScheduledPublishing()`:
     * same command, same cadence, same lock, same schedule name.
     *
     * A minute is the finest granularity the editor's datetime picker offers,
     * so anything coarser would let an author pick a time the worker can't
     * honour. `withoutOverlapping()` keeps a long backlog on a slow database
     * from stacking runs; `onOneServer()` matches the pattern the update-check
     * schedule already uses.
     *
     * The 5-minute lock expiry matters more than it looks. Laravel's default is
     * 24 hours, so a run killed mid-flight (deploy, OOM, host reboot) would
     * leave the lock held and scheduled publishing silently dead for a day —
     * the exact failure this command exists to prevent, reintroduced one level
     * up. Five minutes is comfortably longer than a sweep over any realistic
     * backlog and short enough that a crash costs a handful of minutes.
     *
     * Kept on `callAfterResolving()` rather than moved onto nwidart's
     * `configureSchedules()` hook, following the Updater module (#206) — but
     * note that #206's stated reason does not actually survive contact with the
     * base class.
     * `\Nwidart\Modules\Support\ModuleServiceProvider::registerCommandSchedules()`
     * gates its eager `booted()` → `make(Schedule::class)` on
     * `method_exists($this, 'configureSchedules')`, and the base class *declares*
     * that method (empty body), so `method_exists` is always true and every
     * nwidart module already resolves the scheduler on every request whether it
     * schedules anything or not. So this is not the cheaper option; it is the
     * option that keeps the pre-move code verbatim, which is what a
     * behaviour-preserving extraction wants. The `callAfterResolving` callback
     * fires *during* that same `booted()` resolve, which is why
     * `php artisan schedule:list` still reports the entry.
     */
    protected function registerScheduledPublishing(): void
    {
        $this->callAfterResolving(Schedule::class, static function (Schedule $schedule): void {
            $schedule->command('keystone:publish-scheduled')
                ->everyMinute()
                ->withoutOverlapping(5)
                ->onOneServer()
                ->name('keystone:publish-scheduled');
        });
    }
}
