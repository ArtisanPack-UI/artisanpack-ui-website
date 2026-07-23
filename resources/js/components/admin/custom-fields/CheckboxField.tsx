import type { CustomFieldEditorProps } from './types';
import BooleanField from './BooleanField';

// `checkbox` and `boolean` render the same toggle UI. Keeping a
// standalone module ensures plugin authors can still swap the
// `checkbox` renderer without disturbing the boolean surface.
export default function CheckboxField(props: CustomFieldEditorProps) {
    return <BooleanField {...props} />;
}
