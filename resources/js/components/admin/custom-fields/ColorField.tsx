import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function ColorField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="color" />;
}
