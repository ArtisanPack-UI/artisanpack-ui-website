import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function UrlField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="url" />;
}
