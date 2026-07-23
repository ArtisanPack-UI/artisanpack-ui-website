<?php

declare(strict_types=1);

namespace App\Http\Requests\Admin\ContentModel;

use App\Support\ContentModel\SpecializedContentTypes;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\CMSFramework\Modules\DynamicContent\Models\DynamicContentRecord;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * Validates create/update payloads for the Content Types admin UI. Wraps
 * the cms-framework `ContentTypeManager` — the framework's own
 * `ContentTypeRequest` requires callers to hand in `table_name` +
 * `model_class`, but the Keystone admin UI never asks for those. Both
 * get derived server-side in the controller from the slug + a generic
 * dynamic-content model default, so admins can create a type without
 * knowing about DB tables or Eloquent classes.
 *
 * Authorization is enforced by the route-level `role:admin` middleware.
 */
class ContentTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $slug = $this->route('contentType');

        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                $this->isMethod('POST') ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('content_types', 'slug')->ignore($slug, 'slug'),
                // Reject slugs that collide with any framework/plugin
                // filter-registered content type — filters are not in
                // the `content_types` unique index, so without this an
                // admin could create a DB row that shadows a built-in
                // (e.g. `posts`) and steer the visual editor at the
                // wrong table.
                Rule::notIn($this->registeredContentTypeSlugs()),
            ],
            'description'   => ['nullable', 'string'],
            'icon'          => ['nullable', 'string', Rule::in(self::iconOptions())],
            'menu_position' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'public'        => ['sometimes', 'boolean'],
            'show_in_admin' => ['sometimes', 'boolean'],
            'hierarchical'  => ['sometimes', 'boolean'],
            'has_archive'   => ['sometimes', 'boolean'],
            'archive_slug'  => ['nullable', 'string', 'max:255'],
            'supports'      => ['nullable', 'array'],
            'supports.*'    => [
                'string',
                Rule::in(self::supportsOptions()),
            ],
        ];
    }

    /**
     * Feature flags a content type may declare. Matches the framework's
     * validation list — sourced from `ContentTypeRequest::supports`.
     *
     * @return list<string>
     */
    public static function supportsOptions(): array
    {
        return [
            'title',
            'content',
            'excerpt',
            'featured_image',
            'author',
            'thumbnail',
            'comments',
            'revisions',
            'page_attributes',
            'custom_fields',
        ];
    }

    /**
     * Default model class for admin-created content types. Records are
     * persisted through the framework's DynamicContent module rather than
     * having every admin-created type require a bespoke Eloquent class.
     */
    public static function defaultModelClass(): string
    {
        return DynamicContentRecord::class;
    }

    /**
     * Icon slugs the KeystoneAdminLayout React `Icon` map knows how to
     * render. Anything outside this set displays as blank in the sidebar,
     * so the form must constrain the user to these values rather than
     * accepting free text like `circle-user`.
     *
     * @return list<string>
     */
    public static function iconOptions(): array
    {
        return [
            'dashboard', 'pages', 'posts', 'media', 'cart', 'orders',
            'customers', 'forms', 'site', 'settings', 'users',
            'integrations', 'reports', 'activity', 'bell', 'upload', 'edit',
        ];
    }

    /**
     * Slugs that a new content type must NOT match. The persisted-DB
     * side of the collision is caught by the `unique` rule already;
     * this returns the filter-registered set (post/page/etc.) plus
     * anything the plugins add via `ap.contentTypes.registeredContentTypes`,
     * minus the slug being edited (so a self-referential update passes).
     *
     * @return list<string>
     */
    private function registeredContentTypeSlugs(): array
    {
        $editingSlug = (string) $this->route('contentType');
        $out         = SpecializedContentTypes::SLUGS;

        try {
            $registered = app(ContentTypeManager::class)->getRegisteredContentTypes();
        } catch (Throwable) {
            return array_values(array_unique($out));
        }

        foreach ($registered as $slug => $entry) {
            $entrySlug = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;
            if ('' === $entrySlug || $entrySlug === $editingSlug) {
                continue;
            }
            $out[] = $entrySlug;
        }

        return array_values(array_unique($out));
    }
}
