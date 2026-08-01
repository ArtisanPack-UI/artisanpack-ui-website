import CollapsibleCard from '@/components/admin/CollapsibleCard';
import TaxonomyPicker, { type TaxonomyOption } from './TaxonomyPicker';

interface TagsPanelProps {
    options: TaxonomyOption[];
    selected: number[];
    onToggle: (id: number) => void;
    createUrl: string;
}

export default function TagsPanel({
    options,
    selected,
    onToggle,
    createUrl,
}: TagsPanelProps) {
    const summary =
        selected.length === 0
            ? 'No tags'
            : options
                  .filter((o) => selected.includes(o.value))
                  .map((o) => o.label)
                  .join(', ');

    return (
        <CollapsibleCard title="Tags" summary={summary} defaultOpen>
            <TaxonomyPicker
                ariaLabel="Tags"
                createLabel="Add new tag"
                emptyLabel="No tags yet"
                emptyHint="Create the first tag below to label posts."
                options={options}
                selected={selected}
                onToggle={onToggle}
                createUrl={createUrl}
            />
        </CollapsibleCard>
    );
}
