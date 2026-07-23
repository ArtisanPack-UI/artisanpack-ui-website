import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function DateField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="date" />;
}
