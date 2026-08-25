<?php

declare(strict_types=1);

namespace Modules\ContentModel\Http\Requests;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\SupportsFeature;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\CMSFramework\Modules\DynamicContent\Models\DynamicContentRecord;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\ContentModel\Support\ContentTypeTables;
use Modules\ContentModel\Support\SpecializedContentTypes;
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
                // The slug is only half the collision surface — the table
                // name derived from it is the other half, and it is the
                // one with teeth. `user` derives onto `users`, `medium`
                // onto `media`; provisioning would then ALTER that table
                // and the generic record controller would CRUD rows in it.
                $this->derivedTableIsAvailable(...),
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
     * Feature flags a content type may declare. Sourced from the framework's
     * canonical {@see SupportsFeature} vocabulary — `title` is always on and
     * appears here for the admin UI's completeness rather than as an opt-in.
     *
     * @return list<string>
     */
    public static function supportsOptions(): array
    {
        return SupportsFeature::values();
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
     * Closure rule: reject a slug whose derived records table is already
     * taken by something this feature didn't create.
     *
     * Only meaningful on create — `update()` never changes the slug (and
     * therefore never re-derives the table), so an edit to an existing
     * type must not fail on the table it already legitimately owns.
     *
     * @param  Closure(string): void  $fail
     */
    protected function derivedTableIsAvailable(string $attribute, mixed $value, Closure $fail): void
    {
        if (! $this->isMethod('POST') || ! is_string($value) || '' === $value) {
            return;
        }

        if (ContentTypeTables::claimableBy($value)) {
            return;
        }

        $table = ContentTypeTables::derive($value);
        $owner = ContentTypeTables::ownerSlug($table);

        $fail(null !== $owner
            ? __('The slug ":slug" conflicts with the existing content type ":owner" — both use the ":table" table.', [
                'slug'  => $value,
                'owner' => $owner,
                'table' => $table,
            ])
            : __('The slug ":slug" conflicts with an existing ":table" table.', [
                'slug'  => $value,
                'table' => $table,
            ]));
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
