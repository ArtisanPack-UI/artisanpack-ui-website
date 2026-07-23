import { type ReactNode } from 'react';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
import FeaturedImagePicker, {
    type FeaturedImageRecord,
} from '@/components/admin/FeaturedImagePicker';

/**
 * Shape of the SEO sub-form rendered inside the admin Page / Post edit
 * screens. Mirrors `App\Support\Seo\SeoMetaSupport::payload()` so the
 * server hydrates the form without a separate fetch.
 */
export interface SeoMetaForm {
    meta_title: string;
    meta_description: string;
    canonical_url: string;
    no_index: boolean;
    no_follow: boolean;
    focus_keyword: string;
    og_title: string;
    og_description: string;
    og_image: FeaturedImageRecord | null;
    twitter_card: 'summary' | 'summary_large_image' | 'app' | 'player';
    twitter_title: string;
    twitter_description: string;
    twitter_image: FeaturedImageRecord | null;
    schema_type: string;
    sitemap_priority: number;
    sitemap_changefreq:
        | 'always'
        | 'hourly'
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'yearly'
        | 'never';
    exclude_from_sitemap: boolean;
}

interface SeoMetaCardProps {
    value: SeoMetaForm;
    onChange: (next: SeoMetaForm) => void;
    /** Server-side validation errors keyed by `seo.<field>`. */
    errors?: Record<string, string>;
    /** Distinguish picker instances when multiple are on the same screen. */
    contextPrefix?: string;
}

const TWITTER_CARDS: Array<{ value: SeoMetaForm['twitter_card']; label: string }> = [
    { value: 'summary', label: 'Summary' },
    { value: 'summary_large_image', label: 'Summary with large image' },
    { value: 'app', label: 'App' },
    { value: 'player', label: 'Player' },
];

const CHANGE_FREQS: Array<{ value: SeoMetaForm['sitemap_changefreq']; label: string }> = [
    { value: 'always', label: 'Always' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'never', label: 'Never' },
];

const SCHEMA_TYPES: Array<{ value: string; label: string }> = [
    { value: '', label: 'Auto-detect' },
    { value: 'WebPage', label: 'WebPage' },
    { value: 'Article', label: 'Article' },
    { value: 'BlogPosting', label: 'BlogPosting' },
    { value: 'Product', label: 'Product' },
    { value: 'Event', label: 'Event' },
    { value: 'Recipe', label: 'Recipe' },
    { value: 'FAQPage', label: 'FAQPage' },
    { value: 'HowTo', label: 'HowTo' },
    { value: 'LocalBusiness', label: 'LocalBusiness' },
];

/**
 * SEO meta editor mounted on the Page / Post edit screens. Renders four
 * sub-sections covering meta tags, social cards, schema, and sitemap
 * tuning. All fields are optional — leaving the card untouched produces
 * no `seo_meta` row, so the public site falls back to the site-wide
 * defaults configured under `/admin/settings → SEO`.
 */
export default function SeoMetaCard({
    value,
    onChange,
    errors = {},
    contextPrefix = 'seo',
}: SeoMetaCardProps) {
    function set<K extends keyof SeoMetaForm>(key: K, next: SeoMetaForm[K]) {
        onChange({ ...value, [key]: next });
    }

    const titleLen = value.meta_title.length;
    const descLen = value.meta_description.length;

    const summary = value.meta_title
        ? truncate(value.meta_title, 48)
        : 'Defaults from title & excerpt';

    return (
        <CollapsibleCard title="SEO" summary={summary}>
            <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        title="Search appearance"
                        description="Override the title and description Google + Bing show in results."
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                        <SeoField
                            label="Meta title"
                            hint={`${titleLen}/60 characters`}
                            error={errors['seo.meta_title']}
                            input={
                                <input
                                    type="text"
                                    maxLength={255}
                                    value={value.meta_title}
                                    onChange={(e) => set('meta_title', e.target.value)}
                                    placeholder="Falls back to the page title"
                                    className={textInputClass}
                                />
                            }
                        />
                        <SeoField
                            label="Canonical URL"
                            hint="Use to point search engines at the preferred copy when duplicates exist."
                            error={errors['seo.canonical_url']}
                            input={
                                <input
                                    type="url"
                                    maxLength={500}
                                    value={value.canonical_url}
                                    onChange={(e) => set('canonical_url', e.target.value)}
                                    placeholder="https://example.com/path"
                                    className={textInputClass}
                                />
                            }
                        />
                        <div className="md:col-span-2">
                            <SeoField
                                label="Meta description"
                                hint={`${descLen}/160 characters`}
                                error={errors['seo.meta_description']}
                                input={
                                    <textarea
                                        rows={3}
                                        maxLength={1000}
                                        value={value.meta_description}
                                        onChange={(e) =>
                                            set('meta_description', e.target.value)
                                        }
                                        placeholder="Short summary used in search results."
                                        className={textareaClass}
                                    />
                                }
                            />
                        </div>
                        <SeoField
                            label="Focus keyword"
                            hint="Primary keyword you're targeting (drives the on-page analysis)."
                            error={errors['seo.focus_keyword']}
                            input={
                                <input
                                    type="text"
                                    maxLength={255}
                                    value={value.focus_keyword}
                                    onChange={(e) => set('focus_keyword', e.target.value)}
                                    className={textInputClass}
                                />
                            }
                        />
                        <SeoField
                            label="Indexing"
                            input={
                                <div className="flex flex-col gap-2 pt-1">
                                    <Toggle
                                        checked={value.no_index}
                                        label="noindex"
                                        description="Hide this URL from search engines."
                                        onChange={(v) => set('no_index', v)}
                                    />
                                    <Toggle
                                        checked={value.no_follow}
                                        label="nofollow"
                                        description="Tell crawlers not to follow links on this URL."
                                        onChange={(v) => set('no_follow', v)}
                                    />
                                </div>
                            }
                        />
                    </div>
                </section>

                <section className="flex flex-col gap-4">
                    <SectionHeader
                        title="Social sharing"
                        description="Open Graph + Twitter Card overrides. Defaults fall back to the search appearance fields."
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                        <SeoField
                            label="OG title"
                            error={errors['seo.og_title']}
                            input={
                                <input
                                    type="text"
                                    maxLength={255}
                                    value={value.og_title}
                                    onChange={(e) => set('og_title', e.target.value)}
                                    className={textInputClass}
                                />
                            }
                        />
                        <SeoField
                            label="Twitter / X title"
                            error={errors['seo.twitter_title']}
                            input={
                                <input
                                    type="text"
                                    maxLength={255}
                                    value={value.twitter_title}
                                    onChange={(e) => set('twitter_title', e.target.value)}
                                    className={textInputClass}
                                />
                            }
                        />
                        <SeoField
                            label="OG description"
                            error={errors['seo.og_description']}
                            input={
                                <textarea
                                    rows={3}
                                    maxLength={1000}
                                    value={value.og_description}
                                    onChange={(e) => set('og_description', e.target.value)}
                                    className={textareaClass}
                                />
                            }
                        />
                        <SeoField
                            label="Twitter / X description"
                            error={errors['seo.twitter_description']}
                            input={
                                <textarea
                                    rows={3}
                                    maxLength={1000}
                                    value={value.twitter_description}
                                    onChange={(e) =>
                                        set('twitter_description', e.target.value)
                                    }
                                    className={textareaClass}
                                />
                            }
                        />
                        <SeoField
                            label="OG image"
                            hint="Recommended 1200×630."
                            input={
                                <FeaturedImagePicker
                                    value={value.og_image}
                                    onChange={(picked) => set('og_image', picked)}
                                    context={`${contextPrefix}-og-image`}
                                    placeholderLabel="+ Choose OG image"
                                    modalTitle="Choose an Open Graph image"
                                />
                            }
                        />
                        <SeoField
                            label="Twitter / X image"
                            hint="Same image works for both. Provide a unique one only if you need to."
                            input={
                                <FeaturedImagePicker
                                    value={value.twitter_image}
                                    onChange={(picked) => set('twitter_image', picked)}
                                    context={`${contextPrefix}-twitter-image`}
                                    placeholderLabel="+ Choose Twitter image"
                                    modalTitle="Choose a Twitter Card image"
                                />
                            }
                        />
                        <SeoField
                            label="Twitter / X card style"
                            error={errors['seo.twitter_card']}
                            input={
                                <select
                                    value={value.twitter_card}
                                    onChange={(e) =>
                                        set(
                                            'twitter_card',
                                            e.target.value as SeoMetaForm['twitter_card'],
                                        )
                                    }
                                    className={selectClass}
                                >
                                    {TWITTER_CARDS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                    </div>
                </section>

                <section className="flex flex-col gap-4">
                    <SectionHeader
                        title="Schema & sitemap"
                        description="Override the structured-data type and tune sitemap presence for this URL."
                    />
                    <div className="grid gap-4 md:grid-cols-3">
                        <SeoField
                            label="Schema type"
                            error={errors['seo.schema_type']}
                            input={
                                <select
                                    value={value.schema_type}
                                    onChange={(e) => set('schema_type', e.target.value)}
                                    className={selectClass}
                                >
                                    {SCHEMA_TYPES.map((opt) => (
                                        <option key={opt.value || 'auto'} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <SeoField
                            label="Sitemap change frequency"
                            error={errors['seo.sitemap_changefreq']}
                            input={
                                <select
                                    value={value.sitemap_changefreq}
                                    onChange={(e) =>
                                        set(
                                            'sitemap_changefreq',
                                            e.target
                                                .value as SeoMetaForm['sitemap_changefreq'],
                                        )
                                    }
                                    className={selectClass}
                                >
                                    {CHANGE_FREQS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <SeoField
                            label="Sitemap priority"
                            hint="0.0 to 1.0 — relative importance vs other URLs."
                            error={errors['seo.sitemap_priority']}
                            input={
                                <input
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    max={1}
                                    value={value.sitemap_priority}
                                    onChange={(e) => {
                                        // Empty input resets to the default
                                        // instead of coercing to 0.0 — Number('')
                                        // is 0, which would otherwise look like a
                                        // deliberate "deprioritize this page".
                                        if ('' === e.target.value) {
                                            set('sitemap_priority', 0.5);
                                            return;
                                        }
                                        const parsed = Number(e.target.value);
                                        set(
                                            'sitemap_priority',
                                            Number.isFinite(parsed)
                                                ? Math.max(0, Math.min(1, parsed))
                                                : 0.5,
                                        );
                                    }}
                                    className={textInputClass}
                                />
                            }
                        />
                        <div className="md:col-span-3">
                            <Toggle
                                checked={value.exclude_from_sitemap}
                                label="Exclude from sitemap"
                                description="Keep this URL out of sitemap.xml. Combine with noindex to fully hide it from search."
                                onChange={(v) => set('exclude_from_sitemap', v)}
                            />
                        </div>
                    </div>
                </section>
            </div>
        </CollapsibleCard>
    );
}

const textInputClass =
    'h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary';

const textareaClass =
    'w-full rounded-md border border-base-300/60 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary';

const selectClass = textInputClass;

function SectionHeader({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="border-b border-base-200/70 pb-2">
            <div className="text-sm font-semibold text-base-content/85">{title}</div>
            <div className="text-xs text-base-content/55">{description}</div>
        </div>
    );
}

function SeoField({
    label,
    hint,
    error,
    input,
}: {
    label: string;
    hint?: string;
    error?: string;
    input: ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold text-base-content/85">{label}</span>
            {input}
            {hint && !error && (
                <span className="text-xs text-base-content/55">{hint}</span>
            )}
            {error && <span className="text-xs text-error">{error}</span>}
        </label>
    );
}

function Toggle({
    checked,
    label,
    description,
    onChange,
}: {
    checked: boolean;
    label: string;
    description?: string;
    onChange: (next: boolean) => void;
}) {
    return (
        <label className="flex items-start gap-3 text-sm">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-base-300 text-primary focus:ring-primary"
            />
            <span className="flex flex-col">
                <span className="font-medium text-base-content/85">{label}</span>
                {description && (
                    <span className="text-xs text-base-content/55">
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}

function truncate(value: string, limit: number): string {
    if (value.length <= limit) {
        return value;
    }
    return value.slice(0, limit - 1) + '…';
}
