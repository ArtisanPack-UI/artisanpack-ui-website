<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin\ContentModel;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ContentModel\CustomFieldRequest;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\ContentTypeManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Managers\CustomFieldManager;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Models\CustomField;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Registries\CustomFieldTypeRegistry;
use BackedEnum;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;
use PDOException;
use Throwable;

/**
 * Admin CRUD for custom fields. Wraps `CustomFieldManager` — the
 * manager's create/update/delete run in transactions and mutate the
 * target content-type tables via `addColumnToTable()` /
 * `removeColumnFromTable()`, so the controller stays intentionally thin.
 *
 * Unlike ContentTypes and Taxonomies the framework does not expose a
 * merged "all registered custom fields" getter, so the index endpoint
 * unions the DB rows with the per-content-type filter results.
 */
class CustomFieldController extends Controller
{
    public function __construct(
        private readonly CustomFieldManager $manager,
        private readonly ContentTypeManager $contentTypeManager,
        private readonly CustomFieldTypeRegistry $fieldTypes,
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/content-model/CustomFields', [
            'customFields' => $this->customFieldsPayload(),
            'contentTypes' => $this->contentTypeOptions(),
            'fieldTypes'   => $this->fieldTypeOptions(),
        ]);
    }

    public function store(CustomFieldRequest $request): RedirectResponse
    {
        $data = $request->validated();
        // custom_fields.order is NOT NULL in the framework migration; a
        // blank number input arrives as null, so coerce to 0.
        $data['order']    = $data['order'] ?? 0;
        $data['required'] = (bool) ($data['required'] ?? false);

        try {
            $field = $this->manager->createField($data);
        } catch (PDOException $e) {
            // Framework wraps createField in DB::transaction and calls
            // Schema::table inside it. MySQL auto-commits DDL, so the
            // outer PDO->commit() blows up with "no active transaction"
            // even though the INSERT + ALTER succeeded. Recover if the
            // row is actually there.
            if (! $this->isPhantomTransactionError($e)) {
                report($e);

                return back()->withInput()->withErrors(['key' => __('Failed to create custom field.')]);
            }
            $field = CustomField::where('key', $data['key'] ?? '')->first();
            if (null === $field) {
                report($e);

                return back()->withInput()->withErrors(['key' => __('Failed to create custom field.')]);
            }
        } catch (Throwable $e) {
            report($e);

            return back()->withInput()->withErrors(['key' => __('Failed to create custom field.')]);
        }

        doAction('keystone.admin.contentTypes.customField.registered', $field);

        return redirect()
            ->route('admin.content-model.custom-fields.index')
            ->with('success', __('Custom field ":name" created.', ['name' => $field->name]));
    }

    public function edit(CustomField $customField): Response
    {
        return Inertia::render('admin/content-model/CustomFieldEdit', [
            'customField'  => $this->rowPayload($customField),
            'contentTypes' => $this->contentTypeOptions(),
            'fieldTypes'   => $this->fieldTypeOptions(),
        ]);
    }

    public function update(CustomFieldRequest $request, CustomField $customField): RedirectResponse
    {
        $data = $request->validated();
        // `key` is used to name the DB column via addColumnToTable(). A
        // rename would strand the old column and add a new one; force
        // admins to recreate rather than silently corrupting data.
        unset($data['key']);
        $data['order']    = $data['order'] ?? (int) $customField->order;
        $data['required'] = (bool) ($data['required'] ?? false);

        try {
            $updated = $this->manager->updateField($customField->id, $data);
        } catch (PDOException $e) {
            if (! $this->isPhantomTransactionError($e)) {
                report($e);

                return back()->withInput()->withErrors(['key' => __('Failed to update custom field.')]);
            }
            $updated = $customField->fresh();
        } catch (Throwable $e) {
            report($e);

            return back()
                ->withInput()
                ->withErrors(['key' => __('Failed to update custom field.')]);
        }

        doAction('keystone.admin.contentTypes.customField.updated', $updated);

        return redirect()
            ->route('admin.content-model.custom-fields.index')
            ->with('success', __('Custom field ":name" updated.', ['name' => $updated->name]));
    }

    public function destroy(CustomField $customField): RedirectResponse
    {
        $name = $customField->name;

        try {
            $this->manager->deleteField($customField->id);
        } catch (PDOException $e) {
            if (! $this->isPhantomTransactionError($e)) {
                report($e);

                return back()->withErrors(['key' => __('Failed to delete custom field.')]);
            }
            // DDL auto-committed; if the row is gone the delete succeeded.
            if (CustomField::find($customField->id)) {
                report($e);

                return back()->withErrors(['key' => __('Failed to delete custom field.')]);
            }
        } catch (Throwable $e) {
            report($e);

            return back()->withErrors(['key' => __('Failed to delete custom field.')]);
        }

        // Fire after the manager call succeeds so a failed delete doesn't
        // hand subscribers a phantom "deleted" event. `$customField` is
        // the pre-delete model instance so subscribers still get the
        // full payload.
        doAction('keystone.admin.contentTypes.customField.deleted', $customField);

        return redirect()
            ->route('admin.content-model.custom-fields.index')
            ->with('success', __('Custom field ":name" removed.', ['name' => $name]));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function customFieldsPayload(): array
    {
        $seen = [];
        $rows = [];

        // DB-persisted fields first — they win on key collision with any
        // filter-registered field of the same key.
        foreach (CustomField::query()->orderBy('order')->orderBy('id')->get() as $field) {
            $seen[$field->key] = true;
            $rows[]            = $this->rowPayload($field);
        }

        // Filter-registered fields, keyed off content types (there is no
        // top-level "registered custom fields" getter on the manager).
        foreach ($this->contentTypeManager->getRegisteredContentTypes() as $slug => $entry) {
            $entrySlug = is_array($entry) ? (string) ($entry['slug'] ?? $slug) : (string) $slug;

            foreach ($this->manager->getFieldsForContentType($entrySlug) as $field) {
                if (! $field instanceof CustomField) {
                    continue;
                }
                if ($field->exists || isset($seen[$field->key])) {
                    continue;
                }
                $seen[$field->key] = true;
                $rows[]            = $this->rowPayload($field, isEditable: false);
            }
        }

        return $rows;
    }

    /**
     * @return array<string, mixed>
     */
    private function rowPayload(CustomField $field, bool $isEditable = true): array
    {
        $isEditable = $isEditable && $field->exists;

        return [
            'id'            => $field->id,
            'name'          => $field->name,
            'key'           => $field->key,
            'type'          => $field->type,
            'column_type'   => $field->column_type instanceof BackedEnum ? $field->column_type->value : (string) $field->column_type,
            'description'   => (string) ($field->description ?? ''),
            'content_types' => is_array($field->content_types) ? array_values($field->content_types) : [],
            'options'       => is_array($field->options) ? $field->options : [],
            'order'         => (int) ($field->order ?? 0),
            'required'      => (bool) ($field->required ?? false),
            'default_value' => (string) ($field->default_value ?? ''),
            'is_editable'   => $isEditable,
        ];
    }

    /**
     * @return list<array{slug: string, name: string}>
     */
    private function contentTypeOptions(): array
    {
        $out = [];

        foreach ($this->contentTypeManager->getRegisteredContentTypes() as $slug => $entry) {
            if (! is_array($entry)) {
                continue;
            }
            // Custom field addColumnToTable() only mutates DB-persisted
            // content types; offering filter-registered types would let
            // an admin create a field that silently no-ops.
            if (! isset($entry['id'])) {
                continue;
            }
            $entry['slug'] = (string) ($entry['slug'] ?? $slug);
            $out[]         = [
                'slug' => $entry['slug'],
                'name' => (string) ($entry['name'] ?? $entry['slug']),
            ];
        }

        return $out;
    }

    /**
     * Recognize the MySQL "phantom transaction" tail from the framework's
     * DB::transaction + DDL pattern. MySQL auto-commits DDL, so by the
     * time `DB::transaction` calls `PDO->commit()` the transaction is
     * already gone — but the INSERT + ALTER already ran. If we can
     * observe the intended row state, treating this as success is safer
     * than reporting a failure the admin can't act on.
     */
    private function isPhantomTransactionError(PDOException $e): bool
    {
        return str_contains(strtolower($e->getMessage()), 'no active transaction');
    }

    /**
     * @return list<array{slug: string, label: string, columnType: string}>
     */
    private function fieldTypeOptions(): array
    {
        $out = [];

        foreach ($this->fieldTypes->all() as $definition) {
            // FieldTypeDefinition::columnType is a plain string (Schema
            // method slug like `string`/`text`), not a ColumnType enum —
            // don't try to read ->value off it.
            $out[] = [
                'slug'       => $definition->slug,
                'label'      => $definition->label,
                'columnType' => (string) $definition->columnType,
            ];
        }

        return $out;
    }
}
