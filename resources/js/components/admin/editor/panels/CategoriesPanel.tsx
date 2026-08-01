import CollapsibleCard from '@/components/admin/CollapsibleCard';
import TaxonomyPicker, { type TaxonomyOption } from './TaxonomyPicker';

interface CategoriesPanelProps {
    options: TaxonomyOption[];
    selected: number[];
    onToggle: (id: number) => void;
    createUrl: string;
}

export default function CategoriesPanel({
    options,
    selected,
    onToggle,
    createUrl,
}: CategoriesPanelProps) {
    const summary =
        selected.length === 0
            ? 'Uncategorized'
            : options
                  .filter((o) => selected.includes(o.value))
                  .map((o) => o.label)
                  .join(', ');

    return (
        <CollapsibleCard title="Categories" summary={summary} defaultOpen>
            <TaxonomyPicker
                ariaLabel="Categories"
                createLabel="Add new category"
                emptyLabel="No categories yet"
                emptyHint="Create the first category below to start organizing posts."
                options={options}
                selected={selected}
                onToggle={onToggle}
                createUrl={createUrl}
            />
        </CollapsibleCard>
    );
}
