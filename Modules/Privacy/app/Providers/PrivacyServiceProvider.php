<?php

declare(strict_types=1);

namespace Modules\Privacy\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use App\Support\SettingsPanels;
use ArtisanPackUI\VisualEditor\Facades\VisualEditor;
use Illuminate\Console\Scheduling\Schedule;
use Modules\Privacy\Http\Controllers\Settings\PrivacyController;
use Modules\Privacy\VisualEditor\Blocks\ConsentHistoryBlock;
use Modules\Privacy\VisualEditor\Blocks\DsrRequestBlock;
use Modules\Privacy\VisualEditor\Blocks\DsrStatusBlock;

/**
 * Wires the artisanpack-ui/privacy package into Keystone.
 *
 * The package's PrivacyServiceProvider can auto-register its purge command
 * against Laravel's scheduler, but doing so silently splits schedule
 * ownership between the vendor and the application. Keystone opts the
 * package's auto-registration off (see `config/artisanpack/privacy.php`
 * `scheduling.purge_expired.enabled = false`) and re-registers every
 * recurring privacy command here so the full compliance schedule is
 * discoverable in one place.
 *
 * Commands wired:
 *   - `privacy:purge-expired` — daily at 03:00, removes consent rows
 *     whose expiry has passed.
 *   - `privacy:process-requests` — daily at 04:00, sweeps pending
 *     verified access/export requests.
 *   - `privacy:report --period=month` — monthly on the 1st at 08:00.
 *     Emails the report to `PRIVACY_ADMIN_EMAIL` when configured; falls
 *     back to a JSON file under `storage/app/privacy-reports/` so the
 *     compliance history is captured even without SMTP configured.
 *
 * The provider also claims the Privacy tab of `/admin/settings` through the
 * `keystone.admin.settings.panels` filter ({@see SettingsPanels}), so core
 * never names a Privacy class to render it.
 *
 * The module also owns the ten `privacy_*` migrations —
 * {@see \Nwidart\Modules\Support\ModuleServiceProvider::boot()} loads
 * `database/migrations` for us, so there is no `loadMigrationsFrom()` call
 * here.
 */
class PrivacyServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'Privacy';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'privacy';

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    public function boot(): void
    {
        parent::boot();

        $this->registerVisualEditorBlocks();
        $this->registerSettingsPanel();
    }

    /**
     * Claim the `privacy` tab of `/admin/settings`.
     *
     * The panel payload is the module's to produce, so the module registers
     * it rather than core reaching into
     * {@see PrivacyController::payload()} by name (#235). The closure runs
     * only when `/admin/settings` emits the filter, so the consent-category
     * and DSR-count queries behind `payload()` still cost nothing on every
     * other request.
     *
     * `??=` because the filter contract is first-claim-wins — see
     * {@see SettingsPanels} for the full ordering and collision rules.
     */
    protected function registerSettingsPanel(): void
    {
        if (! function_exists('addFilter')) {
            return;
        }

        addFilter(SettingsPanels::FILTER, static function (mixed $panels): mixed {
            if (! is_array($panels)) {
                return $panels;
            }

            $panels['privacy'] ??= PrivacyController::payload();

            return $panels;
        });
    }

    /**
     * Register the recurring privacy commands.
     *
     * This is nwidart's per-module schedule hook —
     * {@see \Nwidart\Modules\Support\ModuleServiceProvider} calls it once the
     * application has booted, replacing the hand-rolled
     * `callAfterResolving(Schedule::class, ...)` this provider used before
     * the extraction. Same commands, same cadence, same schedule names.
     */
    protected function configureSchedules(Schedule $schedule): void
    {
        $schedule->command('privacy:purge-expired')
            ->dailyAt('03:00')
            ->onOneServer()
            ->name('keystone:privacy-purge-expired');

        $schedule->command('privacy:process-requests')
            ->dailyAt('04:00')
            ->onOneServer()
            ->name('keystone:privacy-process-requests');

        $reportCommand = 'privacy:report --period=month';
        $dpoEmail      = (string) config('artisanpack.privacy.breach.dpo.email', '');
        $adminEmail    = (string) config('artisanpack.privacy.data_requests.admin_email', '');
        $recipient     = '' !== $dpoEmail ? $dpoEmail : $adminEmail;

        if ('' !== $recipient) {
            $reportCommand .= ' --email='.escapeshellarg($recipient);
        } else {
            // Escape as well — `storage_path()` can contain a space
            // on operator-controlled deployments (Windows in
            // particular), and an un-quoted path splits at the
            // whitespace when the scheduler shells the command out.
            $reportCommand .= ' --output='.escapeshellarg(
                storage_path('app/privacy-reports/monthly.json'),
            );
        }

        $schedule->command($reportCommand)
            ->monthlyOn(1, '08:00')
            ->onOneServer()
            ->name('keystone:privacy-monthly-report');
    }

    /**
     * Register Keystone's user-facing DSR blocks with the visual editor.
     *
     * Each block is a thin server-side wrapper that emits a mount div; the
     * `keystone-privacy-island` bundle hydrates them on the client into the
     * package's React components. Rendering as visual-editor blocks (rather
     * than a hard-coded `/account/privacy` page) lets admins drop them onto
     * any page and inherit the active theme's chrome + layout automatically.
     */
    protected function registerVisualEditorBlocks(): void
    {
        if (! class_exists(VisualEditor::class)) {
            return;
        }

        VisualEditor::registerDynamicBlock(ConsentHistoryBlock::class);
        VisualEditor::registerDynamicBlock(DsrRequestBlock::class);
        VisualEditor::registerDynamicBlock(DsrStatusBlock::class);
    }
}
