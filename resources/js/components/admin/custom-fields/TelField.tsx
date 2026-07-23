import type { CustomFieldEditorProps } from './types';
import { SimpleInputField } from './SimpleInputField';

export default function TelField(props: CustomFieldEditorProps) {
    return <SimpleInputField {...props} inputType="tel" inputMode="tel" />;
}
