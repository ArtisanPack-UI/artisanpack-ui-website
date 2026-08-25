<?php

declare(strict_types=1);

namespace Modules\ContentModel\Http\Requests;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates create/update payloads for the Taxonomies admin UI. The
 * framework's `Taxonomy` model stores `content_type_slug` as a scalar
 * column, so a single taxonomy row binds to exactly one content type.
 * Multi-binding (as the issue #105 wishlist suggests) would require a
 * pivot table or JSON column on the framework side — tracked as a
 * follow-up; today the UI mirrors the schema.
 */
class TaxonomyRequest extends FormRequest
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
        $slug = $this->route('taxonomy');

        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                $this->isMethod('POST') ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('taxonomies', 'slug')->ignore($slug, 'slug'),
            ],
            'content_type_slug' => [
                'required',
                'string',
                'max:255',
                // Both the DB `content_types` table and filter-registered
                // types (posts/pages ship as filter entries, not DB rows)
                // are valid binding targets. Rule::exists on the DB alone
                // would reject the framework's built-ins.
                Rule::in($this->registeredContentTypeSlugs()),
            ],
            'description'   => ['nullable', 'string'],
            'hierarchical'  => ['sometimes', 'boolean'],
            'show_in_admin' => ['sometimes', 'boolean'],
            'rest_base'     => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return list<string>
     */
    private function registeredContentTypeSlugs(): array
    {
        /** @var ContentTypeManager $manager */
        $manager = app(ContentTypeManager::class);
        $slugs   = [];

        foreach ($manager->getRegisteredContentTypes() as $slug => $entry) {
            $slugs[] = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;
        }

        return $slugs;
    }
}
