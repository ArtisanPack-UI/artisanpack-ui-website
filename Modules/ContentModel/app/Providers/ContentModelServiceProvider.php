<?php

declare(strict_types=1);

namespace Modules\ContentModel\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use Illuminate\Support\Facades\Gate;
use Modules\ContentModel\Models\DynamicContentEditorModel;
use Modules\ContentModel\Policies\DynamicContentEditorModelPolicy;
use Modules\ContentModel\Support\SpecializedContentTypes;
use Throwable;

/**
 * Boots the ContentModel module.
 *
 * There was no `app/Providers/*ServiceProvider.php` to absorb here (#213) —
 * content types, taxonomies and custom fields are artisanpack-ui/cms-framework's
 * ContentTypes module, which owns those models, their tables and their
 * managers. Keystone's module is the surface around it: the `/admin/content-model`
 * management screens, the generic `/admin/content/{contentType}` record CRUD,
 * and the two Keystone-owned tables (`keystone_content_type_tables`,
 * `keystone_dynamic_content_terms`) whose migrations moved into
 * `database/migrations` alongside — loaded by
 * {@see \Nwidart\Modules\Support\ModuleServiceProvider}, so `database/` is the
 * one generated directory this module keeps. `factories/`
 * and `seeders/` were stripped along with their two autoload entries: neither
 * moved model has a factory, so no `newFactory()` override is needed
 * (plans/14-modular-laravel-setup.md §3.6). `bootstrap/providers.php` is
 * untouched by the extraction.
 *
 * Two registrations moved out of `App\Providers\AppServiceProvider::boot()`,
 * and both are ContentModel-owned rather than merely content-adjacent; see
 * {@see boot()} for why each is safe at this provider's earlier boot slot.
 * Nothing here reads `SettingsManager`, so the §7 step-4 boot-order trap — a
 * module provider now boots ahead of `App\Providers\SettingsServiceProvider`,
 * so `SettingsManager::getSetting()` returns `null` for keys whose defaults
 * have not been registered yet — does not apply.
 *
 * Three references into this module deliberately stayed outside it, because
 * the code holding them is cross-cutting (§3.5) rather than content-model
 * logic: `AppServiceProvider`'s `Gate::before` admin bypass, which only names
 * `DynamicContentEditorModel` to carve an exception *out* of itself;
 * `App\Support\AdminMenu\AdminMenuBuilder`, which asks
 * `SpecializedContentTypes` which slugs already have a bespoke nav entry; and
 * `Modules\SiteEditor\Resources\KeystoneResourceResolver`, which #215 moved
 * into the SiteEditor module — so that third one is now a cross-*module*
 * import rather than a core one.
 */
class ContentModelServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * The name of the module.
     */
    protected string $name = 'ContentModel';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'contentmodel';

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
     * Both registrations are transcribed verbatim from
     * `App\Providers\AppServiceProvider::boot()`.
     *
     * The policy binding is required for the module to work at all: the visual
     * editor's `ResourceContentController` calls
     * `Gate::authorize('view'|'update', $model)` for every request, so without
     * it every dynamic-content-type edit 403s (#111). Registering it earlier in
     * the provider chain is inert — `Gate::policy()` writes into the gate's
     * policy map, which is only consulted when an authorization check runs, and
     * nothing resolves the gate during boot.
     *
     * The `ap.visualEditor.resources` filter is what makes those records
     * reachable in the first place; see {@see registerVisualEditorResources()}.
     * It is also safe earlier: filters are additive rather than
     * last-registration-wins, and nothing else in the app or in vendor
     * registers on that hook name. The closure body — which resolves
     * `ContentTypeManager` and queries the `content_types` table — does not run
     * now, only when the visual editor applies the filter mid-request.
     *
     * The `function_exists` guard is carried over verbatim: the hooks helpers
     * come from artisanpack-ui/hooks via composer `files` autoloading, and the
     * guard keeps boot alive on an install where that package is absent.
     */
    public function boot(): void
    {
        parent::boot();

        Gate::policy(DynamicContentEditorModel::class, DynamicContentEditorModelPolicy::class);

        if (function_exists('addFilter')) {
            $this->registerVisualEditorResources();
            $this->registerEditorPreferencePostTypes();
        }
    }

    /**
     * Widen the editor-preferences post-type allowlist to include every
     * persisted content type so the view-mode switcher (issue #239) persists
     * per content type through the same `user_editor_preferences` store the
     * post/page editors use.
     *
     * Core seeds `['posts', 'pages']`; this contributes the content-type
     * slugs from the module that owns them, rather than
     * {@see \Modules\Users\Http\Controllers\EditorPreferenceController} —
     * which lives in another module — reaching in for them. The allowlist
     * only decides which slugs may seed a preference row; whether the
     * switcher actually renders is gated client-side on the visual editor
     * being present, so an over-broad entry here at worst allows an orphan
     * row that nothing reads (the same posture as the `post_type` column).
     *
     * Mirrors {@see registerVisualEditorResources()}: the closure body runs
     * only when the allowlist is applied mid-request, and is wrapped so a
     * missing `content_types` table on a fresh install can't trip boot.
     */
    protected function registerEditorPreferencePostTypes(): void
    {
        addFilter('keystone.admin.editorPreferences.postTypes', function (array $types): array {
            try {
                $registered = app(ContentTypeManager::class)->getRegisteredContentTypes();
            } catch (Throwable) {
                return $types;
            }

            foreach ($registered as $slug => $entry) {
                $entrySlug = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;

                if ('' === $entrySlug || SpecializedContentTypes::contains($entrySlug)) {
                    continue;
                }

                // Only persisted, admin-visible types have an edit screen that
                // can render the switcher — so only they should be allowed to
                // seed a preference row. Filter-only entries (no `id`) are
                // read-only, and `show_in_admin === false` types are
                // deliberately hidden from the admin. Same exclusions as
                // {@see registerVisualEditorResources()}.
                if (! is_array($entry) || ! isset($entry['id'])) {
                    continue;
                }
                if (false === ($entry['show_in_admin'] ?? true)) {
                    continue;
                }

                $types[] = $entrySlug;
            }

            return $types;
        });
    }

    /**
     * Register every Keystone-persisted content type in the visual-editor
     * resource map so `/visual-editor/api/{slug}/{id}/content` resolves through
     * {@see DynamicContentEditorModel} (#111).
     *
     * Reserved slugs (`post`, `page`, `posts`, `pages`) already have
     * specialized model classes registered by the framework — never overwrite
     * those. Wrapped in try/catch so a missing `content_types` table (fresh
     * install pre-migration) doesn't trip boot.
     */
    protected function registerVisualEditorResources(): void
    {
        addFilter('ap.visualEditor.resources', function (array $map): array {
            try {
                $manager = app(ContentTypeManager::class);
            } catch (Throwable) {
                return $map;
            }

            try {
                $registered = $manager->getRegisteredContentTypes();
            } catch (Throwable) {
                return $map;
            }

            foreach ($registered as $slug => $entry) {
                $entrySlug = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;

                if (SpecializedContentTypes::contains($entrySlug)) {
                    continue;
                }
                if (! is_array($entry) || ! isset($entry['id'])) {
                    // Filter-registered types own their model_class;
                    // don't overwrite them with the generic model.
                    continue;
                }
                // Types the admin deliberately hid (show_in_admin=false)
                // must NOT be reachable via /visual-editor/api/{slug}/{id};
                // otherwise an editor who guesses the slug bypasses
                // the sidebar's visibility gate and can read/write
                // hidden records.
                if (false === ($entry['show_in_admin'] ?? true)) {
                    continue;
                }
                if (isset($map[$entrySlug])) {
                    continue;
                }

                $map[$entrySlug] = DynamicContentEditorModel::class;
            }

            return $map;
        });
    }
}
