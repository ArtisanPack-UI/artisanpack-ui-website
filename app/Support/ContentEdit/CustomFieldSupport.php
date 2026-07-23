<?php

declare(strict_types=1);

namespace App\Support\ContentEdit;

use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\Concerns\HasCustomFields;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\CustomField;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

/**
 * Helpers shared by the admin Post / Page edit screens for loading,
 * validating, and persisting custom fields. Sits in front of the
 * cms-framework's `CustomFieldManager` + `HasCustomFields` trait so
 * both content types render the same field UI and hit the same save
 * pipeline without duplicating the plumbing.
 *
 * The helper deliberately does NOT call `$record->save()` — value
 * assignment happens in memory and the caller runs a single save
 * once all attributes are set, so a controller update fires model
 * observers exactly once instead of twice.
 */
class CustomFieldSupport
{
    /**
     * Serialize the custom fields registered against the given record's
     * content type into the shape the admin edit screen consumes. Each
     * entry carries the field's registration metadata plus the record's
     * current value so the React renderer has everything it needs in one
     * payload.
     *
     * @return list<array{
     *     key: string,
     *     name: string,
     *     type: string,
     *     description: string|null,
     *     options: array<string, mixed>|null,
     *     required: bool,
     *     default_value: string|null,
     *     storage: 'column'|'metadata',
     *     order: int,
     *     value: mixed,
     *     editor_component: string|null,
     *     renderer_component: string|null,
     * }>
     */
    public static function payload(Model $record): array
    {
        return static::fields($record)
            ->map(fn (CustomField $field) => static::fieldPayload($field, $record))
            ->all();
    }

    /**
     * Validation rules for the custom-field subset of the edit form.
     * The renderer submits every value under a single `custom_fields`
     * array so plugin-registered fields don't need to know about the
     * host controller's request shape.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(Model $record): array
    {
        $rules = [
            'custom_fields' => ['nullable', 'array'],
        ];

        foreach (static::fields($record) as $field) {
            $rules["custom_fields.{$field->key}"] = static::rulesForField($field);
        }

        return $rules;
    }

    /**
     * Assign the submitted custom-field values onto the record without
     * saving. The caller (controller) runs `$record->save()` once, so
     * model observers fire exactly once per update.
     *
     * Values submitted for unknown keys are ignored so a stale request
     * (or a plugin that deactivated between load and save) can't stamp
     * garbage attributes onto the model.
     *
     * A key that names a real DB column while the field's storage mode
     * is `metadata` is rejected — the `HasCustomFields` trait would
     * otherwise fall through to the parent `__set` and write past the
     * model's fillable allowlist. Blocks the "custom field named
     * `author_id`" mass-assignment escape.
     *
     * @param  array<string, mixed>|null  $values
     */
    public static function apply(Model $record, ?array $values): void
    {
        if (null === $values || [] === $values) {
            return;
        }

        $fields = static::fields($record)->keyBy('key');

        if ($fields->isEmpty()) {
            return;
        }

        $realColumns = static::realColumns($record);

        foreach ($values as $key => $value) {
            if (! is_string($key) || ! $fields->has($key)) {
                continue;
            }

            $field = $fields->get($key);

            // Metadata-storage field whose key collides with a real
            // column would trigger `parent::__set` inside `HasCustomFields`
            // and bypass the model's fillable list. Drop the write.
            if ('metadata' === $field->storageMode() && in_array($key, $realColumns, true)) {
                continue;
            }

            $record->{$key} = static::castValue($field, $value);
        }
    }

    /**
     * @return Collection<int, CustomField>
     */
    protected static function fields(Model $record): Collection
    {
        // Route through the trait's per-instance memo so `payload()`,
        // `rules()`, and `apply()` all share one lookup per record
        // instance instead of firing a fresh `whereJsonContains` +
        // `applyFilters` pass each.
        if (in_array(HasCustomFields::class, class_uses_recursive($record), true)) {
            /** @var Collection<int, CustomField> */
            return $record->getCustomFieldsForType();
        }

        // Fallback for models that don't use the trait — shouldn't
        // happen with the current Post/Page callers, but keeps the
        // helper usable for any content type that goes through the
        // manager directly.
        return app(\ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\CustomFieldManager::class)
            ->getFieldsForContentType($record->getTable());
    }

    /**
     * List of real DB columns on the record's table, cached per class.
     *
     * @return array<int, string>
     */
    protected static function realColumns(Model $record): array
    {
        static $cache = [];

        $key = $record::class;

        if (! isset($cache[$key])) {
            $cache[$key] = Schema::getColumnListing($record->getTable());
        }

        return $cache[$key];
    }

    /**
     * @return array{
     *     key: string,
     *     name: string,
     *     type: string,
     *     description: string|null,
     *     options: array<string, mixed>|null,
     *     required: bool,
     *     default_value: string|null,
     *     storage: 'column'|'metadata',
     *     order: int,
     *     value: mixed,
     *     editor_component: string|null,
     *     renderer_component: string|null,
     * }
     */
    protected static function fieldPayload(CustomField $field, Model $record): array
    {
        $definition = $field->fieldTypeDefinition();

        return [
            'key'                => (string) $field->key,
            'name'               => (string) $field->name,
            'type'               => (string) $field->type,
            'description'        => $field->description,
            'options'            => is_array($field->options) ? $field->options : null,
            'required'           => (bool) $field->required,
            'default_value'      => $field->default_value,
            'storage'            => $field->storageMode(),
            'order'              => (int) ($field->order ?? 0),
            'value'              => $record->{$field->key},
            'editor_component'   => $definition?->editorComponent,
            'renderer_component' => $definition?->rendererComponent,
        ];
    }

    /**
     * Build the validator rule list for a single field.
     *
     * Booleans and checkboxes are treated specially: `required=true`
     * emits `accepted` (the value must be truthy) rather than `required`,
     * because an unchecked checkbox posts as `false` which passes
     * `required` but is exactly the state a required TOS/consent gate
     * needs to reject. `required=false` allows either state.
     *
     * @return array<int, mixed>
     */
    protected static function rulesForField(CustomField $field): array
    {
        $rules = [];

        if (in_array($field->type, ['boolean', 'checkbox'], true)) {
            $rules[] = $field->required ? 'accepted' : 'nullable';
        } else {
            $rules[] = $field->required ? 'required' : 'nullable';
        }

        $rules = array_merge($rules, match ($field->type) {
            'number'   => ['numeric'],
            'boolean'  => ['boolean'],
            'checkbox' => ['boolean'],
            'email'    => ['string', 'email', 'max:255'],
            'url'      => ['string', 'url', 'max:500'],
            'tel'      => ['string', 'max:50'],
            'color'    => ['string', 'max:32'],
            'date'     => ['date'],
            'datetime' => ['date'],
            'time'     => ['string', 'max:32'],
            'textarea' => ['string', 'max:65535'],
            default    => ['string', 'max:65535'],
        });

        $definition = $field->fieldTypeDefinition();

        if (null !== $definition && [] !== $definition->validationRules) {
            $rules = array_merge($rules, $definition->validationRules);
        }

        return $rules;
    }

    /**
     * Coerce the submitted value into the shape the `HasCustomFields`
     * trait expects to write into the column / metadata JSON.
     */
    protected static function castValue(CustomField $field, mixed $value): mixed
    {
        // Booleans get coerced FIRST so an unchecked HTML checkbox that
        // posts as `''` or `'0'` becomes `false`, not `null`.
        if (in_array($field->type, ['boolean', 'checkbox'], true)) {
            if (null === $value) {
                return null;
            }

            return filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
        }

        if (null === $value || '' === $value) {
            return null;
        }

        return match ($field->type) {
            'number' => is_numeric($value) ? (0 + $value) : null,
            default  => is_scalar($value) ? (string) $value : $value,
        };
    }
}
