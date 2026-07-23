import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function DatetimeField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="datetime-local" />;
}
