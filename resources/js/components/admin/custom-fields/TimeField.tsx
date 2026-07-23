import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function TimeField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="time" />;
}
