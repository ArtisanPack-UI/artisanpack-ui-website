<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Resources;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\VisualEditor\Resources\ResourceResolver;
use Illuminate\Database\Eloquent\Model;
use Modules\ContentModel\Models\DynamicContentEditorModel;
use RuntimeException;

/**
 * Extends the visual editor's `ResourceResolver` so Keystone can bind
 * `DynamicContentEditorModel` to the content type's data table at the
 * exact seam where the resource slug is already in hand.
 *
 * The vendor `ResourceResolver::newModel($resource, $modelClass)`
 * receives the slug as its first argument (see
 * vendor/artisanpack-ui/visual-editor/src/Resources/ResourceResolver.php).
 * We route through it, then — only for our shared model — resolve the
 * content type and call `setTable()` before the query builder runs.
 *
 * This keeps the model constructor plain (no throwing based on request
 * state), so queued jobs, factories, `Model::hydrate()`, and Eloquent
 * event listeners can all instantiate `DynamicContentEditorModel`
 * without crashing.
 */
class KeystoneResourceResolver extends ResourceResolver
{
    protected function newModel(string $resource, string $modelClass): Model
    {
        $model = parent::newModel($resource, $modelClass);

        if ($model instanceof DynamicContentEditorModel) {
            $type = app(ContentTypeManager::class)->getPersistedContentType($resource);

            if (null === $type) {
                // Guard the caller: the vendor resource map may still
                // reference a content type that was deleted mid-flight.
                // The framework's own NotFoundHttpException wrapper
                // will fire on the subsequent findOrFail, but throwing
                // here surfaces the miss with a clearer message.
                throw new RuntimeException(sprintf(
                    'Visual-editor resource "%s" resolves to DynamicContentEditorModel, but no persisted content type exists.',
                    $resource,
                ));
            }

            $model->setTable((string) $type->table_name);
        }

        return $model;
    }
}
