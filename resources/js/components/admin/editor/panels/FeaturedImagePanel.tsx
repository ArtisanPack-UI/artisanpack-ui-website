import CollapsibleCard from '@/components/admin/CollapsibleCard';
import FeaturedImagePicker, {
    type FeaturedImageRecord,
} from '@/components/admin/FeaturedImagePicker';

interface FeaturedImagePanelProps {
    value: FeaturedImageRecord | null;
    onChange: (next: FeaturedImageRecord | null) => void;
    context: string;
    resource: string;
}

export default function FeaturedImagePanel({
    value,
    onChange,
    context,
    resource,
}: FeaturedImagePanelProps) {
    return (
        <CollapsibleCard
            title="Featured image"
            summary={value?.title ?? (value ? 'Image set' : 'No image set')}
            defaultOpen
        >
            <FeaturedImagePicker
                value={value}
                onChange={onChange}
                context={context}
                resource={resource}
            />
        </CollapsibleCard>
    );
}
