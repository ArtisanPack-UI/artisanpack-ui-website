/**
 * Shape of a single custom field as it arrives from the server in the
 * Inertia payload. Matches `CustomFieldSupport::fieldPayload()`.
 */
export type CustomFieldRecord = {
    key: string;
    name: string;
    type: string;
    description: string | null;
    options: Record<string, unknown> | null;
    required: boolean;
    default_value: string | null;
    storage: 'column' | 'metadata';
    order: number;
    value: unknown;
    editor_component: string | null;
    renderer_component: string | null;
};

/**
 * Props every field-type component receives. The renderer owns the value
 * ({@link CustomFieldRecord.value} is the initial hydration only) and
 * pushes changes back via {@link onChange}.
 */
export type CustomFieldEditorProps = {
    field: CustomFieldRecord;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
};
