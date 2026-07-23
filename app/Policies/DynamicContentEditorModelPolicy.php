<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\DynamicContentEditorModel;
use App\Models\User;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;

/**
 * Authorizes visual-editor traffic for dynamic content types
 * ({@see DynamicContentEditorModel}). The framework's
 * `ResourceContentController` gates every request through
 * `Gate::authorize('view'|'update', $model)`, so without a policy
 * every request 403s.
 *
 * Beyond the role check, the policy also re-verifies that the model
 * is bound to a still-registered persisted content type whose
 * `show_in_admin` flag is on. That closes the loop with the
 * `ap.visual-editor.resources` filter registration in
 * {@see \App\Providers\AppServiceProvider}: even if a plugin (or an
 * unrelated startup order) sneaks a hidden or deleted content type
 * back into the resource map, the policy still refuses.
 */
class DynamicContentEditorModelPolicy
{
    public function view(User $user, DynamicContentEditorModel $record): bool
    {
        return $this->hasEditorRole($user) && $this->contentTypeVisible($record);
    }

    public function update(User $user, DynamicContentEditorModel $record): bool
    {
        return $this->hasEditorRole($user) && $this->contentTypeVisible($record);
    }

    private function hasEditorRole(User $user): bool
    {
        return $user->roles
            ->pluck('slug')
            ->intersect(['admin', 'site_owner', 'editor'])
            ->isNotEmpty();
    }

    /**
     * The model's `$table` was set by
     * {@see \App\SiteEditor\KeystoneResourceResolver} to the target
     * content type's `table_name`. Look the content type up by that
     * table — the URL slug was consumed inside the resolver and isn't
     * available here — and verify it's still persisted and admin-visible.
     */
    private function contentTypeVisible(DynamicContentEditorModel $record): bool
    {
        $table = $record->getTable();
        if ('' === $table) {
            return false;
        }

        $type = $this->contentTypeByTable($table);
        if (null === $type) {
            return false;
        }

        return true === (bool) ($type->show_in_admin ?? true);
    }

    /**
     * @return object|null ContentType-shaped result: `{slug, table_name, show_in_admin, ...}`.
     */
    private function contentTypeByTable(string $tableName): ?object
    {
        foreach (app(ContentTypeManager::class)->getRegisteredContentTypes() as $slug => $entry) {
            if (! is_array($entry) || ! isset($entry['id'])) {
                continue;
            }
            if (($entry['table_name'] ?? null) === $tableName) {
                return (object) $entry;
            }
        }

        return null;
    }
}
