<?php

declare(strict_types=1);

namespace Modules\Seo\Providers;

use App\Providers\KeystoneModuleServiceProvider;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\Pages\Models\Page;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use ArtisanPackUI\MediaLibrary\Models\Media;
use ArtisanPackUI\SEO\Models\SeoMeta;
use ArtisanPackUI\SEO\Observers\SeoObserver;
use ArtisanPackUI\SEO\Schema\SchemaFactory;
use ArtisanPackUI\SEO\Services\CacheService;
use ArtisanPackUI\SEO\Services\MetaTagService;
use ArtisanPackUI\SEO\Services\SchemaService;
use ArtisanPackUI\SEO\Services\SeoService;
use ArtisanPackUI\SEO\Services\SocialMetaService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Modules\Seo\Console\Commands\ReconcileSitemap;
use Modules\Seo\Observers\KeystoneSitemapObserver;
use Modules\Seo\Support\KeystoneSchemaService;
use Modules\Seo\Support\KeystoneSeoService;
use Modules\Seo\Support\KeystoneSocialMetaService;
use Throwable;

/**
 * Boots the Seo module and bridges Keystone settings with the
 * artisanpack-ui/seo package.
 *
 * This is `App\Providers\SeoIntegrationServiceProvider` moved wholesale
 * into the module (#205) and re-parented onto
 * {@see KeystoneModuleServiceProvider}, through which it inherits nwidart's
 * {@see \Nwidart\Modules\Support\ModuleServiceProvider} behaviour — adding the
 * module's `RouteServiceProvider` and loading the five `seo_meta` /
 * `sitemap_entries` / `redirects` / `seo_analysis_cache` migrations that moved
 * into `database/migrations` alongside it. Apart from the three `$name` /
 * `$nameLower` / `$providers` module-metadata properties and the deferral
 * noted on `boot()`, everything here is the pre-existing bridge, unchanged:
 *
 * - Wires the `seoMeta` morph relation onto the cms-framework `Page` and
 *   `Post` models so the SEO package can resolve meta without modifying
 *   the upstream classes. The SEO + Sitemap observers are attached the
 *   same way so create/update/delete events keep both tables consistent.
 * - Pushes Keystone's `seo.*` + `general.siteVisibility` settings into
 *   `config('seo.*')` at boot so the package's MetaTagService, robots.txt
 *   generator, OG/Twitter components and schema emission pick up the
 *   admin-configured values without each consumer having to plumb them.
 * - Adds the AI-scraper user-agent rules when `general.siteVisibility =
 *   hide-ai-scrapers`. The classic crawler controls (`noIndex` /
 *   `hide-search-engines`) collapse to a single `Disallow: /` on `*` plus
 *   a site-wide `noindex, nofollow` default robots directive.
 *
 * `config/seo.php` deliberately stays in the application's `config/`
 * directory rather than moving to `Modules/Seo/config/` — see
 * plans/14-modular-laravel-setup.md §4 (row 4) for the measurement behind
 * that call. In short: the vendor `SEOServiceProvider` reads
 * `config('seo.*')` in its own `register()`/`boot()` to decide whether to
 * load the sitemap/robots routes and append the redirect middleware, and
 * a module config is only merged once *this* provider boots — strictly
 * later. The site's settings would arrive after the decisions they are
 * supposed to inform.
 */
class SeoServiceProvider extends KeystoneModuleServiceProvider
{
    /**
     * Known AI scraper / training crawler user-agents that the
     * `hide-ai-scrapers` mode blocks via `robots.txt`. Kept in sync with
     * the published bot lists from OpenAI, Anthropic, Common Crawl,
     * Google extended training, Apple, ByteDance, Meta, Perplexity, and
     * Amazon. Update opportunistically; missing entries fall through to
     * search-engine indexing rules.
     */
    public const AI_SCRAPER_USER_AGENTS = [
        'GPTBot',
        'ChatGPT-User',
        'OAI-SearchBot',
        'ClaudeBot',
        'Claude-Web',
        'anthropic-ai',
        'CCBot',
        'Google-Extended',
        'Applebot-Extended',
        'Bytespider',
        'FacebookBot',
        'Meta-ExternalAgent',
        'PerplexityBot',
        'Amazonbot',
        'cohere-ai',
    ];

    /**
     * The name of the module.
     */
    protected string $name = 'Seo';

    /**
     * The lowercase version of the module name.
     */
    protected string $nameLower = 'seo';

    /**
     * Command classes to register.
     *
     * @var string[]
     */
    protected array $commands = [
        ReconcileSitemap::class,
    ];

    /**
     * Provider classes to register.
     *
     * @var string[]
     */
    protected array $providers = [
        RouteServiceProvider::class,
    ];

    public function register(): void
    {
        parent::register();

        // Replace the SEO package's social-meta and schema services with
        // Keystone subclasses that route the featured-image lookup
        // through `featured_image_id` instead of the cms-framework
        // `HasFeaturedImage` trait's broken MorphOne. See
        // [[hasfeaturedimage-broken]] for the underlying bug.
        $this->app->singleton(SocialMetaService::class, fn (): SocialMetaService => new KeystoneSocialMetaService);

        $this->app->singleton(SchemaService::class, function ($app): SchemaService {
            return new KeystoneSchemaService($app->make(SchemaFactory::class));
        });

        // Replace the SEO package's SeoService with the Keystone subclass
        // so models bound via `Model::resolveRelationUsing()` (rather than
        // the upstream `HasSeo` trait) are still detected. See
        // KeystoneSeoService for the why.
        $this->app->singleton(SeoService::class, function ($app): SeoService {
            return new KeystoneSeoService(
                $app->make(MetaTagService::class),
                $app->make(SocialMetaService::class),
                $app->make(CacheService::class),
            );
        });
    }

    /**
     * The settings bridge used to take `SettingsManager` as a method
     * injection on `boot()`.
     * {@see \Nwidart\Modules\Support\ModuleServiceProvider::boot()} declares a
     * zero-argument signature, so the manager is resolved from the
     * container instead.
     *
     * The config push is deferred to `booted()` rather than run inline, and
     * that is load-bearing. `configureFromKeystoneSettings()` reads keys whose
     * defaults are registered by `App\Providers\SettingsServiceProvider::boot()`
     * (`registerSeoSettings()`), and `SettingsManager::getSetting()` returns
     * `null` for a key that is neither saved to the `settings` table nor
     * registered yet — so reading too early silently substitutes `null` for
     * every unsaved setting's default. Before this module existed the bridge
     * happened to boot after that provider because `bootstrap/providers.php`
     * listed it later; registered by nwidart it boots ~6 providers earlier,
     * which turned `seo.schemaOrganization` / `seo.schemaWebsite` (the only
     * truthy defaults the bridge reads) off site-wide. `booted()` makes the
     * ordering a guarantee instead of a coincidence, which matters with a
     * dozen more module extractions still to land. It fires immediately when
     * the application has already booted, so tests that re-run `boot()` to
     * pick up mid-test settings changes still see the config mutate
     * synchronously.
     *
     * Model binding stays inline: it registers a relation and two observers,
     * neither of which reads settings.
     */
    public function boot(): void
    {
        parent::boot();

        $this->app->booted(function (): void {
            $this->configureFromKeystoneSettings($this->app->make(SettingsManager::class));
        });

        $this->bindSeoToContentModels();
    }

    /**
     * Mutate `config('seo.*')` based on the admin-configured Keystone
     * settings so the SEO package's services / Blade components consume
     * them transparently. Runs every request before the package's
     * singletons resolve.
     */
    protected function configureFromKeystoneSettings(SettingsManager $settings): void
    {
        $siteTitle = (string) $settings->getSetting('site.title');
        $siteUrl   = (string) $settings->getSetting('site.url');

        $defaultMetaTitle       = (string) $settings->getSetting('seo.defaultMetaTitle');
        $defaultMetaDescription = (string) $settings->getSetting('seo.defaultMetaDescription');
        $noIndex                = (bool) $settings->getSetting('seo.noIndex');
        $titleSeparator         = (string) $settings->getSetting('seo.titleSeparator');
        $ogDefaultImageId       = (int) $settings->getSetting('seo.ogDefaultImageId');
        $twitterHandle          = $this->normalizeTwitterHandle((string) $settings->getSetting('seo.twitterHandle'));
        $schemaOrganization     = (bool) $settings->getSetting('seo.schemaOrganization');
        $schemaWebsite          = (bool) $settings->getSetting('seo.schemaWebsite');
        $visibility             = (string) $settings->getSetting('general.siteVisibility');

        $hideFromSearch  = $noIndex || 'hide-search-engines' === $visibility;
        $hideFromAiBots  = 'hide-ai-scrapers' === $visibility;

        // Site identity. The SEO package uses `seo.site.name` as the title
        // suffix and `seo.site.description` as the meta description fallback
        // when nothing else resolves. `seo.site.separator` controls the glue.
        if ('' !== $siteTitle) {
            config(['seo.site.name' => $siteTitle]);
            config(['seo.open_graph.site_name' => $siteTitle]);
            config(['seo.schema.organization.name' => $siteTitle]);
        }

        if ('' !== $siteUrl) {
            config(['seo.schema.organization.url' => $siteUrl]);
        }

        config(['seo.site.separator' => '' !== $titleSeparator ? $titleSeparator : ' | ']);

        if ('' !== $defaultMetaTitle) {
            // Used by the home / default route renderer where there's no
            // model.title to fall back to.
            config(['seo.site.default_title' => $defaultMetaTitle]);
        }

        if ('' !== $defaultMetaDescription) {
            config(['seo.site.description' => $defaultMetaDescription]);
        }

        // Default robots directive. Per-model SeoMeta still wins; this only
        // controls the "no SeoMeta provided" fallback path used in the
        // MetaTagService.
        config([
            'seo.defaults.robots' => $hideFromSearch
                ? 'noindex, nofollow'
                : 'index, follow',
        ]);

        // Robots.txt rules. Reset both arrays so we get a deterministic
        // output regardless of what config/seo.php shipped.
        $globalDisallow = $hideFromSearch ? ['/'] : ['/admin', '/api'];
        config(['seo.robots.disallow' => $globalDisallow]);

        // #154 — plugin authors can extend / redact the enforced
        // user-agent list without forking the constant. Fires on every
        // request regardless of the visibility setting so a subscriber
        // can inspect the canonical list; the surrounding branch keeps
        // the empty list from being written when the setting is off.
        /** @var array<int, string> $userAgents */
        $userAgents = applyFilters('keystone.seo.aiScrapers.userAgents', self::AI_SCRAPER_USER_AGENTS);

        $botRules = [];
        if ($hideFromAiBots) {
            foreach ($userAgents as $bot) {
                if (! is_string($bot) || '' === $bot) {
                    continue;
                }

                $botRules[$bot] = ['disallow' => ['/']];
            }
        }
        config(['seo.robots.rules' => $botRules]);

        // OG / Twitter defaults.
        if ($ogDefaultImageId > 0) {
            $url = $this->resolveMediaUrl($ogDefaultImageId);
            if (null !== $url) {
                config(['seo.open_graph.default_image' => $url]);
                config(['seo.twitter.default_image' => $url]);
            }
        }

        if ('' !== $twitterHandle) {
            config(['seo.twitter.site' => $twitterHandle]);
            config(['seo.twitter.creator' => $twitterHandle]);
        }

        // Schema toggles. The package emits Organization + WebSite JSON-LD
        // automatically for the homepage; flipping these off lets a private
        // / staging site avoid leaking branding into search caches.
        config(['seo.schema.organization.enabled' => $schemaOrganization]);
        config(['seo.schema.website.enabled' => $schemaWebsite]);
    }

    /**
     * Attach `HasSeo`-equivalent wiring to the cms-framework Page + Post
     * models without subclassing them. `Model::resolveRelationUsing` adds
     * the morph relation that the SEO package's services + Blade
     * components look for; `Model::observe` matches the trait's boot
     * behavior so creates/updates/deletes keep the seo_meta and
     * sitemap_entries tables in sync.
     *
     * The sitemap observer is Keystone's {@see KeystoneSitemapObserver}
     * rather than the vendor `SitemapObserver`, so entries stay in step
     * with `PublicVisibility` and unpublished content never leaks into
     * `sitemap.xml` (#234).
     */
    protected function bindSeoToContentModels(): void
    {
        foreach ([Page::class, Post::class] as $modelClass) {
            $modelClass::resolveRelationUsing(
                'seoMeta',
                fn (Model $model): MorphOne => $model->morphOne(SeoMeta::class, 'seoable'),
            );

            $modelClass::observe(SeoObserver::class);
            $modelClass::observe(KeystoneSitemapObserver::class);
        }
    }

    /**
     * Normalize a Twitter / X handle to the `@username` form the SEO
     * package expects. Returns an empty string when the input has no
     * usable username characters so the config push leaves the defaults
     * intact.
     */
    protected function normalizeTwitterHandle(string $handle): string
    {
        $handle = trim($handle);

        if ('' === $handle) {
            return '';
        }

        $handle = ltrim($handle, '@');
        $handle = preg_replace('/[^A-Za-z0-9_]/', '', $handle) ?? '';

        return '' === $handle ? '' : '@'.$handle;
    }

    /**
     * Resolve a public URL for a media library image so it can be used as
     * the OG / Twitter default. Returns null when the media library is
     * unavailable or the row was deleted.
     */
    protected function resolveMediaUrl(int $mediaId): ?string
    {
        if (! class_exists(Media::class)) {
            return null;
        }

        try {
            $media = Media::query()->find($mediaId);
        } catch (Throwable) {
            return null;
        }

        if (null === $media) {
            return null;
        }

        return (string) $media->url();
    }
}
