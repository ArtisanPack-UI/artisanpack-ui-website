import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function NumberField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="number" inputMode="numeric" />;
}
