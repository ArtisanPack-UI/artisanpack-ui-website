import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function EmailField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="email" />;
}
