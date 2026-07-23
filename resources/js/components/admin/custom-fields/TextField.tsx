import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function TextField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="text" />;
}
