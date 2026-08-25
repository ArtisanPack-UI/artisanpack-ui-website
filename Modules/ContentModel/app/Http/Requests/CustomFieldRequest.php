<?php

declare(strict_types=1);

namespace Modules\ContentModel\Http\Requests;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ColumnType;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Registries\CustomFieldTypeRegistry;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates create/update payloads for the Custom Fields admin UI.
 * `type` is constrained to the currently-registered field-type slugs
 * (built-ins plus anything plugins register through
 * `CustomFieldTypeRegistry`); `column_type` is constrained to the
 * framework's `ColumnType` enum values. `content_types` is a JSON array
 * — the framework's `CustomField.content_types` cast is already an
 * array, and each entry needs to reference an existing DB-persisted
 * content type so `CustomFieldManager::addColumnToTable()` has a real
 * table to mutate.
 */
class CustomFieldRequest extends FormRequest
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
        $id = $this->route('customField');

        return [
            'name' => ['required', 'string', 'max:255'],
            'key'  => [
                $this->isMethod('POST') ? 'required' : 'nullable',
                'string',
                'max:255',
                'regex:/^[a-z0-9_]+$/',
                Rule::unique('custom_fields', 'key')->ignore($id),
            ],
            'type' => [
                'required',
                'string',
                Rule::in($this->fieldTypeSlugs()),
            ],
            'column_type'     => ['required', Rule::enum(ColumnType::class)],
            'description'     => ['nullable', 'string'],
            'content_types'   => ['required', 'array', 'min:1'],
            'content_types.*' => [
                'string',
                Rule::exists('content_types', 'slug'),
            ],
            'options'        => ['nullable', 'array'],
            'order'          => ['nullable', 'integer', 'min:0', 'max:9999'],
            'required'       => ['sometimes', 'boolean'],
            'default_value'  => ['nullable', 'string'],
        ];
    }

    /**
     * @return list<string>
     */
    private function fieldTypeSlugs(): array
    {
        /** @var CustomFieldTypeRegistry $registry */
        $registry = app(CustomFieldTypeRegistry::class);

        return $registry->slugs();
    }
}
