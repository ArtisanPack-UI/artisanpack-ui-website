<?php

declare(strict_types=1);

namespace Modules\Seo\Support;

use ArtisanPackUI\SEO\Models\SeoMeta;
use ArtisanPackUI\SEO\Services\SeoService;
use Illuminate\Database\Eloquent\Model;

/**
 * Keystone-flavored extension of the upstream SEO service.
 *
 * The package's stock `getSeoMeta()` relies on `method_exists($model,
 * 'seoMeta')` to decide whether a model supports SEO. We attach the
 * relation to the cms-framework Page + Post models via
 * `Model::resolveRelationUsing()` (see [[seo-integration-provider]])
 * instead of using the upstream `HasSeo` trait — so `method_exists`
 * returns false even though the relation is wired and `$model->seoMeta`
 * works. Override the check to use `Model::isRelation()` so the
 * package's services + Blade components actually load the
 * polymorphic record.
 */
class KeystoneSeoService extends SeoService
{
    public function getSeoMeta(Model $model): ?SeoMeta
    {
        if ($this->modelSupportsSeo($model)) {
            return $model->seoMeta;
        }

        return null;
    }

    protected function modelSupportsSeo(Model $model): bool
    {
        if (method_exists($model, 'seoMeta')) {
            return true;
        }

        return $model->isRelation('seoMeta');
    }
}
