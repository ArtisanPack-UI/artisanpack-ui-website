import { useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import { keystoneConfirm } from '@/lib/admin/confirm';
import { ToastProvider, useToast } from '@artisanpack-ui/react/feedback';
import type { FormDataConvertible } from '@inertiajs/core';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, Icon, PageHeader, StatusBadge } from '@/components/admin/keystone';
import { MediaModal } from '@/vendor/media-library';
import type { Media } from '@/vendor/media-library/types/media';
import {
    saveRegisteredSettings,
    saveSiteSettings,
    SettingsApiError,
    type ValidationErrors,
} from '@/lib/admin/settingsApi';
import { formatPhpDate } from '@/lib/admin/phpDateFormat';
import type { AdminSettings, AdminSettingsOptions, BrandLogo } from '@/types/keystone';
import admin from '@/routes/admin';

type TabKey =
    | 'general'
    | 'brand'
    | 'seo'
    | 'discussion'
    | 'permalinks'
    | 'notifications'
    | 'security'
    | 'privacy'
    | 'performance'
    | 'developers'
    | 'billing';

const CUSTOM = '__custom__';

const tabs: Array<{ key: TabKey; label: string }> = [
    { key: 'general', label: 'General' },
    { key: 'brand', label: 'Brand' },
    { key: 'seo', label: 'SEO' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'permalinks', label: 'Permalinks' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'security', label: 'Security' },
    { key: 'privacy', label: 'Privacy' },
    { key: 'performance', label: 'Performance' },
    { key: 'developers', label: 'Developers' },
    { key: 'billing', label: 'Billing' },
];

const VISIBILITY_OPTIONS = [
    { value: 'public', label: 'Public' },
    { value: 'password-protected', label: 'Password protected' },
    { value: 'hide-search-engines', label: 'Hidden from search engines' },
    { value: 'hide-ai-scrapers', label: 'Hidden from AI scrapers' },
];

const COMMENT_APPROVAL_OPTIONS = [
    { value: 'manually-approved', label: 'Hold for manual approval' },
    { value: 'previously-approved', label: 'Approve if author was approved before' },
    { value: 'automatically-approved', label: 'Approve automatically' },
];

/**
 * WordPress-style "common settings" presets for the post permalink
 * structure. The sample values below feed the live preview so an admin can
 * see the resulting URL shape before saving.
 */
const PERMALINK_PRESETS = [
    { value: '/%post_name%/', label: 'Post name' },
    { value: '/%year%/%monthnum%/%day%/%post_name%/', label: 'Day and name' },
    { value: '/%year%/%monthnum%/%post_name%/', label: 'Month and name' },
    { value: '/%category%/%post_name%/', label: 'Category and name' },
];

const PERMALINK_TAGS = [
    { tag: '%post_name%', label: 'Post slug' },
    { tag: '%year%', label: 'Year' },
    { tag: '%monthnum%', label: 'Month' },
    { tag: '%day%', label: 'Day' },
    { tag: '%category%', label: 'Category' },
];

/** Replace permalink tags with sample values for the structure preview. */
function permalinkPreview(structure: string): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');

    const path = structure
        .replace(/%post_name%/g, 'my-first-post')
        .replace(/%year%/g, String(now.getFullYear()))
        .replace(/%monthnum%/g, pad(now.getMonth() + 1))
        .replace(/%day%/g, pad(now.getDate()))
        .replace(/%category%/g, 'news');

    return `/${path.replace(/^\/+|\/+$/g, '')}/`;
}

interface SettingsProps {
    settings: AdminSettings;
    options: AdminSettingsOptions;
}

/* -------------------------------------------------------------------------- */
/* Reusable field primitives                                                  */
/* -------------------------------------------------------------------------- */

function Field({
    label,
    helper,
    error,
    htmlFor,
    children,
}: {
    label: string;
    helper?: string;
    error?: string;
    htmlFor?: string;
    children: ReactNode;
}) {
    // Wrap the built-in field body through `.settings.field.render` so a
    // plugin can decorate / wrap / replace an individual settings field
    // (e.g. add an inline "Learn more" popover, gate a field behind a
    // feature flag, or swap the control for a plugin-owned variant).
    // The filter sees the RAW body (control + helper/error) so a
    // subscriber can wrap it in an extra chrome layer without losing
    // access to the built-in label — the label is rendered outside the
    // filter chain so it stays associated with the underlying `htmlFor`.
    // Args: `(ReactNode, { label, htmlFor, error, helper })`.
    const body = (
        <>
            {children}
            {error ? (
                <span className="text-[11px] text-error">{error}</span>
            ) : helper ? (
                <span className="text-[11px] text-base-content/55">{helper}</span>
            ) : null}
        </>
    );

    const filteredBody = applyFilters<ReactNode>(
        'keystone.admin.settings.field.render',
        body,
        { label, htmlFor, error, helper },
    );

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-xs font-semibold text-base-content">
                {label}
            </label>
            {filteredBody}
        </div>
    );
}

const inputClasses =
    'h-9 rounded-lg border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary';

function TextInput({
    id,
    value,
    onChange,
    placeholder,
    type = 'text',
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <input
            id={id}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
        />
    );
}

function NumberInput({
    id,
    value,
    onChange,
    min = 0,
}: {
    id?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
}) {
    return (
        <input
            id={id}
            type="number"
            min={min}
            value={value}
            onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange(Number.isNaN(parsed) ? 0 : parsed);
            }}
            className={`${inputClasses} w-32`}
        />
    );
}

function Textarea({
    id,
    value,
    onChange,
    rows = 3,
    placeholder,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    placeholder?: string;
}) {
    return (
        <textarea
            id={id}
            value={value}
            rows={rows}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-lg border border-base-300/60 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary"
        />
    );
}

function Select({
    id,
    value,
    onChange,
    options,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}

function Toggle({
    checked,
    onChange,
    label,
    description,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
}) {
    return (
        <label className="flex cursor-pointer items-start gap-3">
            <span className="relative mt-0.5 inline-block h-5 w-9 shrink-0">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="peer sr-only"
                />
                <span className="block h-5 w-9 rounded-full bg-base-content/25 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40" />
                <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
            </span>
            <span>
                <span className="block text-sm font-semibold text-base-content">{label}</span>
                {description && (
                    <span className="block text-xs text-base-content/55">{description}</span>
                )}
            </span>
        </label>
    );
}

/* -------------------------------------------------------------------------- */
/* Panel shell — header, body, and a per-panel Save/Cancel footer             */
/* -------------------------------------------------------------------------- */

function PanelShell({
    title,
    description,
    saving,
    dirty,
    onSave,
    onCancel,
    children,
}: {
    title: string;
    description: string;
    saving: boolean;
    dirty: boolean;
    onSave: () => void;
    onCancel: () => void;
    children: ReactNode;
}) {
    return (
        <Card>
            <div className="border-b border-base-300/60 pb-4">
                <h2 className="font-display text-lg font-semibold text-base-content">{title}</h2>
                <p className="mt-1 text-sm text-base-content/65">{description}</p>
            </div>
            <div className="pt-5">{children}</div>
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-base-300/60 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={!dirty || saving}
                    className="rounded-lg border border-base-300/60 bg-base-100 px-4 py-2 text-sm font-semibold text-base-content/75 hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={!dirty || saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-content shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving && (
                        <span
                            aria-hidden
                            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-content/60 border-t-transparent"
                        />
                    )}
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </Card>
    );
}

/**
 * Shared save lifecycle: tracks `saving` and the validation bag, runs the
 * supplied save closures, and surfaces a success/error toast. Returns a
 * `run` that resolves true on success so callers can snapshot a new baseline.
 */
function usePanelSave() {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<ValidationErrors>({});

    async function run(save: () => Promise<unknown>): Promise<boolean> {
        setSaving(true);
        setErrors({});
        try {
            await save();
            toast.success('Settings saved.');
            return true;
        } catch (error) {
            if (error instanceof SettingsApiError) {
                setErrors(error.errors);
                toast.error(error.message || 'Could not save settings.');
            } else {
                toast.error('Could not save settings.');
            }
            return false;
        } finally {
            setSaving(false);
        }
    }

    return { saving, errors, run };
}

/* -------------------------------------------------------------------------- */
/* General                                                                    */
/* -------------------------------------------------------------------------- */

function FormatSelect({
    label,
    id,
    presets,
    selection,
    custom,
    onSelectionChange,
    onCustomChange,
}: {
    label: string;
    id: string;
    presets: Array<{ key: string; label: string }>;
    selection: string;
    custom: string;
    onSelectionChange: (value: string) => void;
    onCustomChange: (value: string) => void;
}) {
    const preview = useMemo(() => {
        try {
            return formatPhpDate(new Date(), custom);
        } catch {
            return 'Invalid format';
        }
    }, [custom]);

    return (
        <Field label={label} htmlFor={id}>
            <Select
                id={id}
                value={selection}
                onChange={onSelectionChange}
                options={[
                    ...presets.map((p) => ({ value: p.key, label: p.label })),
                    { value: CUSTOM, label: 'Custom' },
                ]}
            />
            {selection === CUSTOM && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                    <TextInput value={custom} onChange={onCustomChange} placeholder="e.g. F j, Y" />
                    <span className="text-[11px] text-base-content/55">
                        Preview:{' '}
                        <span className="font-semibold text-base-content">{preview || '—'}</span>
                    </span>
                </div>
            )}
        </Field>
    );
}

/** Resolve a stored format string to a (selection, custom) pair. */
function toFormatState(
    value: string,
    presets: Array<{ key: string }>,
): { selection: string; custom: string } {
    const isPreset = presets.some((p) => p.key === value);
    return isPreset ? { selection: value, custom: '' } : { selection: CUSTOM, custom: value };
}

function GeneralPanel({
    data,
    options,
}: {
    data: AdminSettings['general'];
    options: AdminSettingsOptions;
}) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const initialDate = toFormatState(data.dateFormat, options.dateFormats);
    const initialTime = toFormatState(data.timeFormat, options.timeFormats);
    const [dateSel, setDateSel] = useState(initialDate.selection);
    const [dateCustom, setDateCustom] = useState(initialDate.custom);
    const [timeSel, setTimeSel] = useState(initialTime.selection);
    const [timeCustom, setTimeCustom] = useState(initialTime.custom);
    const [sitePassword, setSitePassword] = useState('');
    const { saving, errors, run } = usePanelSave();

    const dateFormat = dateSel === CUSTOM ? dateCustom : dateSel;
    const timeFormat = timeSel === CUSTOM ? timeCustom : timeSel;

    const dirty =
        form.siteName !== baseline.siteName ||
        form.siteUrl !== baseline.siteUrl ||
        form.description !== baseline.description ||
        form.timezone !== baseline.timezone ||
        form.locale !== baseline.locale ||
        form.weekStart !== baseline.weekStart ||
        form.visibility !== baseline.visibility ||
        sitePassword !== '' ||
        dateFormat !== baseline.dateFormat ||
        timeFormat !== baseline.timeFormat;

    function set<K extends keyof AdminSettings['general']>(
        key: K,
        value: AdminSettings['general'][K],
    ) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function reset() {
        setForm(baseline);
        const d = toFormatState(baseline.dateFormat, options.dateFormats);
        const t = toFormatState(baseline.timeFormat, options.timeFormats);
        setDateSel(d.selection);
        setDateCustom(d.custom);
        setTimeSel(t.selection);
        setTimeCustom(t.custom);
        setSitePassword('');
    }

    async function save() {
        const next = { ...form, dateFormat, timeFormat };
        const registered: Record<string, unknown> = {
            'general.timezone': next.timezone,
            'general.locale': next.locale,
            'general.weekStart': next.weekStart,
            'general.dateFormat': next.dateFormat,
            'general.timeFormat': next.timeFormat,
            'general.siteVisibility': next.visibility,
        };
        // Only send the password when the admin typed a new one; an empty
        // field leaves the stored (hashed) password untouched.
        if (sitePassword !== '') {
            registered['general.sitePassword'] = sitePassword;
        }
        const ok = await run(() =>
            Promise.all([
                saveSiteSettings({
                    title: next.siteName,
                    description: next.description,
                    url: next.siteUrl,
                }),
                saveRegisteredSettings(registered),
            ]),
        );
        if (ok) {
            setBaseline({
                ...next,
                hasSitePassword: sitePassword !== '' ? true : next.hasSitePassword,
            });
            setSitePassword('');
        }
    }

    return (
        <PanelShell
            title="General"
            description="Basic site information, localization, and date formatting."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={reset}
        >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Field label="Site name" htmlFor="site-name" error={errors.title?.[0]}>
                    <TextInput
                        id="site-name"
                        value={form.siteName}
                        onChange={(v) => set('siteName', v)}
                    />
                </Field>
                <Field label="Public URL" htmlFor="site-url" error={errors.url?.[0]}>
                    <TextInput
                        id="site-url"
                        value={form.siteUrl}
                        onChange={(v) => set('siteUrl', v)}
                    />
                </Field>
                <Field label="Timezone" htmlFor="timezone">
                    <Select
                        id="timezone"
                        value={form.timezone}
                        onChange={(v) => set('timezone', v)}
                        options={options.timezones.map((tz) => ({ value: tz, label: tz }))}
                    />
                </Field>
                <Field label="Default language" htmlFor="locale">
                    <Select
                        id="locale"
                        value={form.locale}
                        onChange={(v) => set('locale', v)}
                        options={options.locales}
                    />
                </Field>
                <Field label="Week starts on" htmlFor="week-start">
                    <Select
                        id="week-start"
                        value={form.weekStart}
                        onChange={(v) => set('weekStart', v)}
                        options={options.weekDays}
                    />
                </Field>
                <Field
                    label="Site visibility"
                    htmlFor="site-visibility"
                    helper="Control who can see and index the public site."
                >
                    <Select
                        id="site-visibility"
                        value={form.visibility}
                        onChange={(v) => set('visibility', v)}
                        options={VISIBILITY_OPTIONS}
                    />
                </Field>
                {form.visibility === 'password-protected' ? (
                    <Field
                        label="Site access password"
                        htmlFor="site-password"
                        helper={
                            baseline.hasSitePassword
                                ? 'A password is set. Enter a new one to change it, or leave blank to keep it.'
                                : 'Set the shared password visitors must enter to view the public site.'
                        }
                        error={errors['general.sitePassword']?.[0]}
                    >
                        <TextInput
                            id="site-password"
                            type="password"
                            value={sitePassword}
                            onChange={setSitePassword}
                            placeholder={baseline.hasSitePassword ? '••••••••' : ''}
                        />
                    </Field>
                ) : null}
                <Field
                    label="Description"
                    htmlFor="description"
                    helper="Used for the homepage meta description fallback."
                    error={errors.description?.[0]}
                >
                    <TextInput
                        id="description"
                        value={form.description}
                        onChange={(v) => set('description', v)}
                    />
                </Field>
                <FormatSelect
                    label="Date format"
                    id="date-format"
                    presets={options.dateFormats}
                    selection={dateSel}
                    custom={dateCustom}
                    onSelectionChange={setDateSel}
                    onCustomChange={setDateCustom}
                />
                <FormatSelect
                    label="Time format"
                    id="time-format"
                    presets={options.timeFormats}
                    selection={timeSel}
                    custom={timeCustom}
                    onSelectionChange={setTimeSel}
                    onCustomChange={setTimeCustom}
                />
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

function LogoPicker({
    value,
    onChange,
}: {
    value: BrandLogo | null;
    onChange: (value: BrandLogo | null) => void;
}) {
    const [open, setOpen] = useState(false);

    function handleSelect(media: Media[]) {
        const picked = media[0];
        if (picked) {
            onChange({ id: picked.id, url: picked.url });
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {value ? (
                <div className="flex items-center gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-md border border-base-300/60 bg-base-200">
                        <img
                            src={value.url}
                            alt="Site logo"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            className="rounded-md border border-base-300/60 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/75 hover:bg-base-200"
                        >
                            Replace
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="rounded-md border border-error/30 bg-base-100 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="grid h-20 w-full max-w-xs place-items-center rounded-md border-2 border-dashed border-base-300 bg-base-200/30 text-sm font-semibold text-base-content/65 hover:border-primary hover:text-primary"
                >
                    + Choose logo
                </button>
            )}
            <MediaModal
                open={open}
                onClose={() => setOpen(false)}
                onSelect={handleSelect}
                allowedTypes={['image']}
                context="site-logo"
                title="Choose a site logo"
            />
        </div>
    );
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label}>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={`${label} color`}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-base-300/60 bg-base-100"
                />
                <TextInput value={value} onChange={onChange} placeholder="#0855b1" />
            </div>
        </Field>
    );
}

function BrandPanel({ data }: { data: AdminSettings['brand'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const { saving, run } = usePanelSave();

    const dirty =
        form.primaryColor !== baseline.primaryColor ||
        form.secondaryColor !== baseline.secondaryColor ||
        form.accentColor !== baseline.accentColor ||
        form.forceTheme !== baseline.forceTheme ||
        (form.logo?.id ?? null) !== (baseline.logo?.id ?? null);

    function set<K extends keyof AdminSettings['brand']>(key: K, value: AdminSettings['brand'][K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        const ok = await run(() =>
            Promise.all([
                saveSiteSettings({ site_logo: form.logo?.id ?? null }),
                saveRegisteredSettings({
                    'admin.primaryColor': form.primaryColor,
                    'admin.secondaryColor': form.secondaryColor,
                    'admin.accentColor': form.accentColor,
                    'admin.forceTheme': form.forceTheme,
                }),
            ]),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Brand"
            description="Logo and admin theme palette."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-6">
                <Field
                    label="Logo"
                    helper="Shown in the admin sidebar and on the public site logo block."
                >
                    <LogoPicker value={form.logo} onChange={(v) => set('logo', v)} />
                </Field>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <ColorField
                        label="Primary color"
                        value={form.primaryColor}
                        onChange={(v) => set('primaryColor', v)}
                    />
                    <ColorField
                        label="Secondary color"
                        value={form.secondaryColor}
                        onChange={(v) => set('secondaryColor', v)}
                    />
                    <ColorField
                        label="Accent color"
                        value={form.accentColor}
                        onChange={(v) => set('accentColor', v)}
                    />
                </div>
                <Field label="Force theme" helper="Override the visitor's light/dark preference.">
                    <Select
                        value={form.forceTheme}
                        onChange={(v) => set('forceTheme', v)}
                        options={[
                            { value: 'system', label: 'Respect visitor preference' },
                            { value: 'light', label: 'Always light' },
                            { value: 'dark', label: 'Always dark' },
                        ]}
                    />
                </Field>
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* SEO                                                                        */
/* -------------------------------------------------------------------------- */

function SeoPanel({ data }: { data: AdminSettings['seo'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const { saving, errors, run } = usePanelSave();

    const dirty =
        form.defaultMetaTitle !== baseline.defaultMetaTitle ||
        form.defaultMetaDescription !== baseline.defaultMetaDescription ||
        form.noIndex !== baseline.noIndex ||
        form.titleSeparator !== baseline.titleSeparator ||
        form.ogDefaultImageId !== baseline.ogDefaultImageId ||
        form.twitterHandle !== baseline.twitterHandle ||
        form.schemaOrganization !== baseline.schemaOrganization ||
        form.schemaWebsite !== baseline.schemaWebsite;

    function set<K extends keyof AdminSettings['seo']>(key: K, value: AdminSettings['seo'][K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        const ok = await run(() =>
            saveRegisteredSettings({
                'seo.defaultMetaTitle': form.defaultMetaTitle,
                'seo.defaultMetaDescription': form.defaultMetaDescription,
                'seo.noIndex': form.noIndex,
                'seo.titleSeparator': form.titleSeparator,
                'seo.ogDefaultImageId': form.ogDefaultImageId,
                'seo.twitterHandle': form.twitterHandle,
                'seo.schemaOrganization': form.schemaOrganization,
                'seo.schemaWebsite': form.schemaWebsite,
            }),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="SEO"
            description="Default search metadata, social cards, and indexing controls applied site-wide."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-4">
                    <PanelSection
                        title="Search appearance"
                        description="Per-page meta overrides everything here; this is the last-resort fallback."
                    />
                    <Field
                        label="Default meta title"
                        htmlFor="meta-title"
                        helper="Used when a page provides no title of its own."
                        error={errors['settings.seo.defaultMetaTitle']?.[0]}
                    >
                        <TextInput
                            id="meta-title"
                            value={form.defaultMetaTitle}
                            onChange={(v) => set('defaultMetaTitle', v)}
                        />
                    </Field>
                    <Field
                        label="Default meta description"
                        htmlFor="meta-description"
                        error={errors['settings.seo.defaultMetaDescription']?.[0]}
                    >
                        <Textarea
                            id="meta-description"
                            value={form.defaultMetaDescription}
                            onChange={(v) => set('defaultMetaDescription', v)}
                        />
                    </Field>
                    <Field
                        label="Title separator"
                        htmlFor="title-separator"
                        helper={"Glue between page title and site name, e.g. \" | \", \" — \", or \" · \"."}
                        error={errors['settings.seo.titleSeparator']?.[0]}
                    >
                        <TextInput
                            id="title-separator"
                            value={form.titleSeparator}
                            onChange={(v) => set('titleSeparator', v)}
                        />
                    </Field>
                    <Toggle
                        checked={form.noIndex}
                        onChange={(v) => set('noIndex', v)}
                        label="Discourage search engines"
                        description="Emits a site-wide noindex meta tag and a Disallow: / robots.txt rule. Leave off for public sites."
                    />
                </section>

                <section className="flex flex-col gap-4">
                    <PanelSection
                        title="Social defaults"
                        description="Open Graph + Twitter Card defaults for pages that don't supply their own."
                    />
                    <Field
                        label="Default OG image"
                        htmlFor="og-image"
                        helper="Media library ID for the fallback 1200×630 share image. 0 disables."
                        error={errors['settings.seo.ogDefaultImageId']?.[0]}
                    >
                        <TextInput
                            id="og-image"
                            value={String(form.ogDefaultImageId)}
                            onChange={(v) => {
                                const parsed = Number(v.replace(/[^0-9]/g, ''));
                                set(
                                    'ogDefaultImageId',
                                    Number.isFinite(parsed) ? parsed : 0,
                                );
                            }}
                        />
                    </Field>
                    <Field
                        label="Twitter / X handle"
                        htmlFor="twitter-handle"
                        helper="Including the @ is optional. Used for site + creator attribution."
                        error={errors['settings.seo.twitterHandle']?.[0]}
                    >
                        <TextInput
                            id="twitter-handle"
                            value={form.twitterHandle}
                            onChange={(v) => set('twitterHandle', v)}
                        />
                    </Field>
                </section>

                <section className="flex flex-col gap-4">
                    <PanelSection
                        title="Schema (JSON-LD)"
                        description="Toggle the structured-data the SEO package emits on every page."
                    />
                    <Toggle
                        checked={form.schemaOrganization}
                        onChange={(v) => set('schemaOrganization', v)}
                        label="Organization schema"
                        description="Tells Google about the company that owns this site."
                    />
                    <Toggle
                        checked={form.schemaWebsite}
                        onChange={(v) => set('schemaWebsite', v)}
                        label="Website schema"
                        description="Adds the WebSite + SearchAction markup used for sitelinks search box."
                    />
                </section>
            </div>
        </PanelShell>
    );
}

function PanelSection({
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

/* -------------------------------------------------------------------------- */
/* Discussion                                                                 */
/* -------------------------------------------------------------------------- */

function DiscussionPanel({ data }: { data: AdminSettings['discussion'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const { saving, run } = usePanelSave();

    const dirty =
        form.comments !== baseline.comments ||
        form.commentsApproval !== baseline.commentsApproval ||
        form.bannedWords !== baseline.bannedWords ||
        form.requireRegistration !== baseline.requireRegistration ||
        form.limitLinks !== baseline.limitLinks ||
        form.captcha !== baseline.captcha;

    function set<K extends keyof AdminSettings['discussion']>(
        key: K,
        value: AdminSettings['discussion'][K],
    ) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        const ok = await run(() =>
            saveRegisteredSettings({
                'discussion.comments': form.comments,
                'discussion.commentsApproval': form.commentsApproval,
                'discussion.bannedWords': form.bannedWords,
                'discussion.requireRegistration': form.requireRegistration,
                'discussion.limitLinks': form.limitLinks,
                'discussion.captcha': form.captcha,
            }),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Discussion"
            description="Comment moderation and spam controls."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-5">
                <Toggle
                    checked={form.comments}
                    onChange={(v) => set('comments', v)}
                    label="Allow comments"
                    description="Let visitors leave comments on posts and pages."
                />
                <Field
                    label="Comment approval"
                    htmlFor="comments-approval"
                    helper="How new comments are moderated before they appear."
                >
                    <Select
                        id="comments-approval"
                        value={form.commentsApproval}
                        onChange={(v) => set('commentsApproval', v)}
                        options={COMMENT_APPROVAL_OPTIONS}
                    />
                </Field>
                <Toggle
                    checked={form.requireRegistration}
                    onChange={(v) => set('requireRegistration', v)}
                    label="Require registration"
                    description="Only logged-in users can comment."
                />
                <Toggle
                    checked={form.captcha}
                    onChange={(v) => set('captcha', v)}
                    label="Require CAPTCHA"
                    description="Add a CAPTCHA challenge to the comment form."
                />
                <Field
                    label="Max links per comment"
                    htmlFor="limit-links"
                    helper="Hold comments with more than this many links. 0 means no limit."
                >
                    <NumberInput
                        id="limit-links"
                        value={form.limitLinks}
                        onChange={(v) => set('limitLinks', v)}
                    />
                </Field>
                <Field
                    label="Banned words"
                    htmlFor="banned-words"
                    helper="One word or phrase per line. Matching comments are held for moderation."
                >
                    <Textarea
                        id="banned-words"
                        rows={4}
                        value={form.bannedWords}
                        onChange={(v) => set('bannedWords', v)}
                    />
                </Field>
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Permalinks                                                                 */
/* -------------------------------------------------------------------------- */

/** A stored structure that matches no preset starts the panel in custom mode. */
function isCustomStructure(structure: string): boolean {
    return !PERMALINK_PRESETS.some((p) => p.value === structure);
}

function PermalinksPanel({ data }: { data: AdminSettings['permalinks'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    // Tracks whether the admin explicitly chose "Custom structure". Kept
    // separate from the value so picking Custom while the text happens to
    // match a preset (e.g. /%post_name%/) doesn't snap back to that preset.
    const [customMode, setCustomMode] = useState(() => isCustomStructure(data.structure));
    const { saving, run } = usePanelSave();

    const dirty = form.structure !== baseline.structure;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    function selectPreset(structure: string) {
        setCustomMode(false);
        setForm({ structure });
    }

    function setCustom(structure: string) {
        setForm({ structure });
    }

    function insertTag(tag: string) {
        setForm((prev) => ({ structure: `${prev.structure}${tag}` }));
    }

    function reset() {
        setForm(baseline);
        setCustomMode(isCustomStructure(baseline.structure));
    }

    async function save() {
        const ok = await run(() =>
            saveRegisteredSettings({ 'permalinks.structure': form.structure }),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Permalinks"
            description="Choose the URL structure for your published posts."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={reset}
        >
            <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold text-base-content">
                        Common settings
                    </h3>
                    <div className="flex flex-col gap-2.5">
                        {PERMALINK_PRESETS.map((preset) => (
                            <label
                                key={preset.value}
                                className="flex cursor-pointer items-center gap-3"
                            >
                                <input
                                    type="radio"
                                    name="permalink-structure"
                                    checked={!customMode && form.structure === preset.value}
                                    onChange={() => selectPreset(preset.value)}
                                    className="h-4 w-4 accent-primary"
                                />
                                <span className="text-sm text-base-content">
                                    {preset.label}
                                </span>
                                <span className="font-mono text-[11px] text-base-content/55">
                                    {origin}
                                    {permalinkPreview(preset.value)}
                                </span>
                            </label>
                        ))}

                        <label className="flex cursor-pointer items-center gap-3">
                            <input
                                type="radio"
                                name="permalink-structure"
                                checked={customMode}
                                onChange={() => setCustomMode(true)}
                                className="h-4 w-4 accent-primary"
                            />
                            <span className="text-sm text-base-content">
                                Custom structure
                            </span>
                        </label>
                    </div>
                </section>

                {customMode && (
                    <Field
                        label="Custom structure"
                        htmlFor="permalink-structure-custom"
                        helper="Use the tags below to build your own structure. Every structure must include %post_name%."
                    >
                        <TextInput
                            id="permalink-structure-custom"
                            value={form.structure}
                            onChange={setCustom}
                            placeholder="/%post_name%/"
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {PERMALINK_TAGS.map((item) => (
                                <button
                                    key={item.tag}
                                    type="button"
                                    onClick={() => insertTag(item.tag)}
                                    title={`Insert ${item.label}`}
                                    className="rounded-md border border-base-300/60 bg-base-100 px-2 py-1 font-mono text-[11px] text-base-content/75 hover:bg-base-200"
                                >
                                    {item.tag}
                                </button>
                            ))}
                        </div>
                        <span className="mt-1.5 font-mono text-[11px] text-base-content/55">
                            Preview: {origin}
                            {permalinkPreview(form.structure || '/%post_name%/')}
                        </span>
                    </Field>
                )}

                <section className="rounded-lg border border-base-300/60 bg-base-200/40 p-4">
                    <h3 className="text-xs font-semibold text-base-content">
                        How permalinks work
                    </h3>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-base-content/65">
                        The permalink structure controls the public URL of every
                        published post. Pick a common setting, or build a custom
                        structure from these tags:
                    </p>
                    <ul className="mt-2 flex flex-col gap-1 text-[11px] text-base-content/65">
                        <li>
                            <code className="font-mono text-base-content">%post_name%</code>{' '}
                            — the post slug (required).
                        </li>
                        <li>
                            <code className="font-mono text-base-content">%year%</code>,{' '}
                            <code className="font-mono text-base-content">%monthnum%</code>,{' '}
                            <code className="font-mono text-base-content">%day%</code> — the
                            post&apos;s publish date parts.
                        </li>
                        <li>
                            <code className="font-mono text-base-content">%category%</code>{' '}
                            — the post&apos;s primary category slug.
                        </li>
                    </ul>
                    <p className="mt-2 text-[11px] leading-relaxed text-base-content/65">
                        Existing posts are always reachable at{' '}
                        <code className="font-mono text-base-content">/blog/&lt;slug&gt;</code>{' '}
                        as a fallback, so changing the structure never breaks old links
                        outright. Changes apply to links generated across the site as soon
                        as you save.
                    </p>
                </section>
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Security                                                                   */
/* -------------------------------------------------------------------------- */

function SecurityPanel({ data }: { data: AdminSettings['security'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const { saving, run } = usePanelSave();

    const dirty =
        form.loginAttempts !== baseline.loginAttempts ||
        form.loginTimeout !== baseline.loginTimeout ||
        form.forceTwoFactor !== baseline.forceTwoFactor;

    function set<K extends keyof AdminSettings['security']>(
        key: K,
        value: AdminSettings['security'][K],
    ) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        const ok = await run(() =>
            saveRegisteredSettings({
                'security.loginAttempts': form.loginAttempts,
                'security.loginTimeout': form.loginTimeout,
                'security.forceTwoFactor': form.forceTwoFactor,
            }),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Security"
            description="Login hardening and two-factor enforcement."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-5">
                <Field
                    label="Max login attempts"
                    htmlFor="login-attempts"
                    helper="Failed attempts before an account is temporarily locked."
                >
                    <NumberInput
                        id="login-attempts"
                        min={1}
                        value={form.loginAttempts}
                        onChange={(v) => set('loginAttempts', v)}
                    />
                </Field>
                <Field
                    label="Lockout timeout (seconds)"
                    htmlFor="login-timeout"
                    helper="How long an account stays locked after too many failed attempts."
                >
                    <NumberInput
                        id="login-timeout"
                        min={1}
                        value={form.loginTimeout}
                        onChange={(v) => set('loginTimeout', v)}
                    />
                </Field>
                <Toggle
                    checked={form.forceTwoFactor}
                    onChange={(v) => set('forceTwoFactor', v)}
                    label="Force two-factor authentication"
                    description="Require every user to set up 2FA before accessing the admin."
                />
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

const NOTIFICATION_FIELDS: Array<{
    key: keyof AdminSettings['notifications'];
    label: string;
    description: string;
}> = [
    { key: 'newOrders', label: 'New orders', description: 'Email me when an order is placed.' },
    { key: 'lowStock', label: 'Low stock', description: 'Alert me when inventory runs low.' },
    { key: 'newLeads', label: 'New leads', description: 'Get notified for every form submission.' },
    { key: 'dailyDigest', label: 'Daily digest', description: 'A morning summary at 8:00 AM.' },
    {
        key: 'weeklyReport',
        label: 'Weekly traffic report',
        description: 'Sent every Monday at 9:00 AM.',
    },
];

function NotificationsPanel({ data }: { data: AdminSettings['notifications'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const { saving, run } = usePanelSave();

    const dirty = NOTIFICATION_FIELDS.some((f) => form[f.key] !== baseline[f.key]);

    async function save() {
        const ok = await run(() =>
            saveRegisteredSettings({
                'notifications.newOrders': form.newOrders,
                'notifications.lowStock': form.lowStock,
                'notifications.newLeads': form.newLeads,
                'notifications.dailyDigest': form.dailyDigest,
                'notifications.weeklyReport': form.weeklyReport,
            }),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Notifications"
            description="Choose what triggers an email or in-app alert."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-4">
                {NOTIFICATION_FIELDS.map((f) => (
                    <Toggle
                        key={f.key}
                        checked={form[f.key]}
                        onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                        label={f.label}
                        description={f.description}
                    />
                ))}
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Privacy                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The Privacy panel payload. `NonNullable` because the key is optional on
 * `AdminSettings` — the Privacy module contributes it through the
 * `keystone.admin.settings.panels` filter, so it is absent when the module
 * isn't there — but the panel only renders once the payload is present.
 */
type PrivacyPanelData = NonNullable<AdminSettings['privacy']>;

const PRIVACY_REGULATIONS: Array<{
    key: keyof PrivacyPanelData['settings'];
    label: string;
    description: string;
}> = [
    {
        key: 'gdpr_enabled',
        label: 'GDPR (EU / EEA / UK)',
        description: 'Explicit consent, 30-day DSR window, 72-hour breach notification.',
    },
    {
        key: 'ccpa_enabled',
        label: 'CCPA (California)',
        description: 'Do-Not-Sell affordance, 45-day DSR window, financial-incentive disclosures.',
    },
    {
        key: 'lgpd_enabled',
        label: 'LGPD (Brazil)',
        description: 'Consent-based processing, ANPD notification workflow.',
    },
    {
        key: 'pipeda_enabled',
        label: 'PIPEDA (Canada)',
        description: 'Reasonable-purpose test, meaningful consent, breach reporting.',
    },
];

// Row shapes below `extends Record<string, FormDataConvertible>` so
// Inertia's router.post / .patch keep the payload compile-time checked
// without an `as never` escape hatch. Every field here is a value
// Inertia can serialize directly into FormData.
type PrivacySettingsForm = PrivacyPanelData['settings'] & Record<string, FormDataConvertible>;
type NewPrivacyCategoryForm = {
    key: string;
    name: string;
    description: string;
    required: boolean;
    active: boolean;
    sort_order: number;
} & Record<string, FormDataConvertible>;
type UpdatePrivacyCategoryForm = {
    name: string;
    description: string;
    required: boolean;
    active: boolean;
    sort_order: number;
} & Record<string, FormDataConvertible>;

function PrivacyPanel({ data }: { data: PrivacyPanelData }) {
    const [baseline, setBaseline] = useState<PrivacySettingsForm>(data.settings);
    const [form, setForm] = useState<PrivacySettingsForm>(data.settings);
    const { saving, errors, run } = usePanelSave();
    const toast = useToast();
    const [addingCategory, setAddingCategory] = useState(false);
    const [categoryErrors, setCategoryErrors] = useState<Record<string, string>>({});
    const [newCategory, setNewCategory] = useState<NewPrivacyCategoryForm>({
        key: '',
        name: '',
        description: '',
        required: false,
        active: true,
        sort_order: data.categories.length,
    });

    const dirty = useMemo(
        () => (Object.keys(form) as Array<keyof PrivacySettingsForm>).some((k) => form[k] !== baseline[k]),
        [form, baseline],
    );

    function setField<K extends keyof PrivacySettingsForm>(key: K, value: PrivacySettingsForm[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        // The privacy update endpoint writes to `.env` (regulation
        // toggles, DPO contact, retention window) rather than the
        // Settings API surface — it needs its own POST rather than
        // going through saveRegisteredSettings.
        const ok = await run(async () => {
            await new Promise<void>((resolve, reject) => {
                router.post(admin.settings.privacy.update().url, form, {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: (bag) => {
                        // Inertia hands us `Record<string, string>` — the
                        // first error message per field. Wrap each into a
                        // one-element array so it matches the shape the
                        // panel's `errors` state expects.
                        const errors: ValidationErrors = {};
                        for (const [field, message] of Object.entries(bag)) {
                            errors[field] = [message];
                        }
                        reject(new SettingsApiError('Please review the highlighted fields.', 422, errors));
                    },
                    onCancel: () =>
                        // A cancelled visit (user navigated away, or a
                        // second submit interrupted us) never fires
                        // onSuccess or onError, so the promise would
                        // otherwise hang and `saving` would stay true
                        // until the panel unmounted. Reject with a
                        // non-user-facing sentinel so `run()` clears
                        // saving without pinning validation errors.
                        reject(new SettingsApiError('Save cancelled.', 499, {})),
                });
            });
        });
        if (ok) {
            setBaseline(form);
        }
    }

    function addCategory(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCategoryErrors({});
        router.post(admin.settings.privacy.categories.store().url, newCategory, {
            preserveScroll: true,
            onSuccess: () => {
                setAddingCategory(false);
                setNewCategory({
                    key: '',
                    name: '',
                    description: '',
                    required: false,
                    active: true,
                    sort_order: data.categories.length + 1,
                });
            },
            onError: (bag) => {
                setCategoryErrors(bag);
                toast.error('Please review the highlighted fields.');
            },
        });
    }

    function toggleCategory(
        category: PrivacyPanelData['categories'][number],
        field: 'active' | 'required',
    ) {
        const payload: UpdatePrivacyCategoryForm = {
            name: category.name,
            description: category.description ?? '',
            required: field === 'required' ? !category.required : category.required,
            active: field === 'active' ? !category.active : category.active,
            sort_order: category.sort_order,
        };
        router.patch(
            admin.settings.privacy.categories.update({ category: category.id }).url,
            payload,
            {
                preserveScroll: true,
                // Toggle failures are effectively guardrail messages
                // (e.g. "required categories cannot be deleted"). We
                // don't have a form to bind field errors to, so surface
                // the first message as a toast instead of dropping it.
                onError: (bag) => {
                    const first = Object.values(bag)[0];
                    if (first) {
                        toast.error(first);
                    }
                },
            },
        );
    }

    function deleteCategory(category: PrivacyPanelData['categories'][number]) {
        if (category.required) {
            return;
        }
        if (!keystoneConfirm(`Delete the "${category.name}" consent category? This will not affect stored consents.`)) {
            return;
        }
        router.delete(admin.settings.privacy.categories.destroy({ category: category.id }).url, {
            preserveScroll: true,
            onError: (bag) => {
                const first = Object.values(bag)[0];
                if (first) {
                    toast.error(first);
                }
            },
        });
    }

    return (
        <div className="flex flex-col gap-5">
            <section className="grid gap-4 md:grid-cols-3">
                <Card>
                    <div className="text-sm text-base-content/60">Stored consents</div>
                    <div className="mt-1 text-3xl font-semibold">
                        {data.stats.consent_rows.toLocaleString()}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-base-content/60">Pending DSR reviews</div>
                    <div className="mt-1 text-3xl font-semibold">
                        {data.stats.pending_dsr_requests.toLocaleString()}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-base-content/60">Total DSR requests</div>
                    <div className="mt-1 text-3xl font-semibold">
                        {data.stats.total_dsr_requests.toLocaleString()}
                    </div>
                </Card>
            </section>

            <PanelShell
                title="Privacy"
                description="Regulations, DPO contact, and retention windows for the artisanpack-ui/privacy package. Values persist to .env."
                saving={saving}
                dirty={dirty}
                onSave={save}
                onCancel={() => setForm(baseline)}
            >
                <div className="flex flex-col gap-6">
                    <div>
                        <h3 className="text-sm font-semibold text-base-content">Enabled regulations</h3>
                        <p className="mt-1 text-xs text-base-content/60">
                            A visitor is treated under every enabled regulation that applies to their region. Turning one off suppresses its DSR window, breach requirements, and consent copy.
                        </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                        {PRIVACY_REGULATIONS.map((reg) => (
                            <label
                                key={reg.key}
                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300/60 bg-base-100 p-4 hover:bg-base-200/60"
                            >
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-primary mt-0.5"
                                    checked={Boolean(form[reg.key])}
                                    onChange={(e) => setField(reg.key, e.target.checked as never)}
                                />
                                <span>
                                    <span className="block text-sm font-medium">{reg.label}</span>
                                    <span className="mt-1 block text-xs text-base-content/60">
                                        {reg.description}
                                    </span>
                                </span>
                            </label>
                        ))}
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-base-content">Contacts</h3>
                        <p className="mt-1 text-xs text-base-content/60">
                            Notification recipients used by the DSR inbox and breach templates. Leave a field blank to fall back to the next available recipient (DPO → admin).
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <Field
                            label="Admin email"
                            htmlFor="privacy-admin-email"
                            helper="Receives new-DSR notifications and monthly report if no DPO is set."
                            error={errors?.admin_email?.[0]}
                        >
                            <TextInput
                                id="privacy-admin-email"
                                type="email"
                                value={form.admin_email}
                                onChange={(v) => setField('admin_email', v)}
                            />
                        </Field>
                        <Field
                            label="Data protection officer name"
                            htmlFor="privacy-dpo-name"
                            error={errors?.dpo_name?.[0]}
                        >
                            <TextInput
                                id="privacy-dpo-name"
                                value={form.dpo_name}
                                onChange={(v) => setField('dpo_name', v)}
                            />
                        </Field>
                        <Field
                            label="DPO email"
                            htmlFor="privacy-dpo-email"
                            helper="Preferred recipient of the monthly compliance report."
                            error={errors?.dpo_email?.[0]}
                        >
                            <TextInput
                                id="privacy-dpo-email"
                                type="email"
                                value={form.dpo_email}
                                onChange={(v) => setField('dpo_email', v)}
                            />
                        </Field>
                        <Field
                            label="DPO phone"
                            htmlFor="privacy-dpo-phone"
                            error={errors?.dpo_phone?.[0]}
                        >
                            <TextInput
                                id="privacy-dpo-phone"
                                value={form.dpo_phone}
                                onChange={(v) => setField('dpo_phone', v)}
                            />
                        </Field>
                        <Field
                            label="Supervisory authority email"
                            htmlFor="privacy-authority-email"
                            helper="CC&rsquo;d on outbound breach notifications."
                            error={errors?.authority_email?.[0]}
                        >
                            <TextInput
                                id="privacy-authority-email"
                                type="email"
                                value={form.authority_email}
                                onChange={(v) => setField('authority_email', v)}
                            />
                        </Field>
                        <Field
                            label="Retention window (days)"
                            htmlFor="privacy-retention-days"
                            helper="How long inactive user records are kept before automated purge picks them up."
                            error={errors?.retention_days?.[0]}
                        >
                            <TextInput
                                id="privacy-retention-days"
                                type="number"
                                value={form.retention_days === null ? '' : String(form.retention_days)}
                                onChange={(v) =>
                                    setField('retention_days', v === '' ? null : Number.parseInt(v, 10))
                                }
                            />
                        </Field>
                    </div>
                </div>
            </PanelShell>

            <Card>
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="font-display text-lg font-semibold text-base-content">
                            Consent categories
                        </h2>
                        <p className="mt-1 text-sm text-base-content/65">
                            Categories shown in the cookie banner and stored on each visitor&rsquo;s consent record. Required categories cannot be disabled by visitors.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                            setCategoryErrors({});
                            setAddingCategory((v) => !v);
                        }}
                    >
                        {addingCategory ? 'Cancel' : 'Add category'}
                    </button>
                </div>

                {addingCategory && (
                    <form
                        onSubmit={addCategory}
                        className="mb-6 grid grid-cols-1 gap-5 rounded-lg border border-base-300/60 bg-base-100 p-4 lg:grid-cols-2"
                    >
                        <Field
                            label="Key"
                            htmlFor="privacy-category-key"
                            helper="Machine identifier — lowercase, digits, dashes, underscores."
                            error={categoryErrors.key}
                        >
                            <TextInput
                                id="privacy-category-key"
                                value={newCategory.key}
                                onChange={(v) => setNewCategory((p) => ({ ...p, key: v }))}
                            />
                        </Field>
                        <Field
                            label="Name"
                            htmlFor="privacy-category-name"
                            error={categoryErrors.name}
                        >
                            <TextInput
                                id="privacy-category-name"
                                value={newCategory.name}
                                onChange={(v) => setNewCategory((p) => ({ ...p, name: v }))}
                            />
                        </Field>
                        <div className="lg:col-span-2">
                            <Field
                                label="Description"
                                htmlFor="privacy-category-description"
                                error={categoryErrors.description}
                            >
                                <TextInput
                                    id="privacy-category-description"
                                    value={newCategory.description}
                                    onChange={(v) =>
                                        setNewCategory((p) => ({ ...p, description: v }))
                                    }
                                />
                            </Field>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm checkbox-primary"
                                checked={newCategory.required}
                                onChange={(e) =>
                                    setNewCategory((p) => ({ ...p, required: e.target.checked }))
                                }
                            />
                            <span>Required</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm checkbox-primary"
                                checked={newCategory.active}
                                onChange={(e) =>
                                    setNewCategory((p) => ({ ...p, active: e.target.checked }))
                                }
                            />
                            <span>Active</span>
                        </label>
                        <div className="lg:col-span-2">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-content shadow-sm hover:bg-primary-hover"
                            >
                                Add category
                            </button>
                        </div>
                    </form>
                )}

                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Key</th>
                                <th>Required</th>
                                <th>Active</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.categories.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center text-base-content/60">
                                        No consent categories defined yet.
                                    </td>
                                </tr>
                            )}
                            {data.categories.map((category) => (
                                <tr key={category.id}>
                                    <td>
                                        <div className="font-medium">{category.name}</div>
                                        {category.description && (
                                            <div className="text-xs text-base-content/60">
                                                {category.description}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <code className="text-xs">{category.key}</code>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => toggleCategory(category, 'required')}
                                            className="btn btn-xs btn-ghost"
                                            aria-label={`Toggle required for ${category.name}`}
                                        >
                                            <StatusBadge
                                                status={category.required ? 'active' : 'inactive'}
                                                label={category.required ? 'Yes' : 'No'}
                                                tone={category.required ? 'success' : 'neutral'}
                                            />
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => toggleCategory(category, 'active')}
                                            className="btn btn-xs btn-ghost"
                                            aria-label={`Toggle active for ${category.name}`}
                                        >
                                            <StatusBadge
                                                status={category.active ? 'active' : 'inactive'}
                                                label={category.active ? 'On' : 'Off'}
                                                tone={category.active ? 'success' : 'neutral'}
                                            />
                                        </button>
                                    </td>
                                    <td className="text-right">
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-ghost text-error"
                                            onClick={() => deleteCategory(category)}
                                            disabled={category.required}
                                            title={
                                                category.required
                                                    ? 'Required categories cannot be deleted.'
                                                    : 'Delete'
                                            }
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Performance                                                                */
/* -------------------------------------------------------------------------- */

/** @see PrivacyPanelData — same filter-contributed contract. */
type PerformancePanelData = NonNullable<AdminSettings['performance']>;

const PERFORMANCE_FEATURE_TOGGLES: Array<{
    key: keyof PerformancePanelData['settings'];
    label: string;
    description: string;
}> = [
    {
        key: 'image_optimization',
        label: 'Image optimization',
        description:
            'Auto-generate WebP + AVIF variants, responsive sizes, and LQIP placeholders when media is uploaded.',
    },
    {
        key: 'page_cache',
        label: 'Page cache',
        description:
            'Layered below Keystone’s origin response cache; caches full public pages that aren’t already covered.',
    },
    {
        key: 'fragment_cache',
        label: 'Fragment cache',
        description:
            'Tag-invalidated per-fragment cache. Invalidations bridge to the Cloudflare purge job when it lands.',
    },
    {
        key: 'monitoring',
        label: 'RUM Web Vitals monitoring',
        description:
            'Auto-injects the Web Vitals collector on every public HTML response. Respects analytics consent.',
    },
    {
        key: 'speculative_loading',
        label: 'Speculative loading',
        description:
            'Emit a speculation-rules document to prefetch or prerender likely next navigations. Off by default.',
    },
    {
        key: 'resource_hints',
        label: 'Resource hints',
        description: 'Inject preconnect/dns-prefetch/preload hints derived from the rendered document.',
    },
    {
        key: 'early_hints',
        label: 'Early Hints (HTTP 103)',
        description:
            'Ship an interim 103 response with preload hints ahead of the final 200. Requires a webserver that supports it.',
    },
    {
        key: 'html_minification',
        label: 'HTML minification',
        description: 'Strip comments and collapse whitespace on the response body. Off by default.',
    },
    {
        key: 'query_optimization',
        label: 'Query optimization',
        description:
            'Enables N+1 detection and slow query logging. Enable to see samples on Performance → Slow Queries.',
    },
];

type PerformanceSettingsForm = PerformancePanelData['settings'] & Record<string, FormDataConvertible>;

function PerformancePanel({ data }: { data: PerformancePanelData }) {
    const [baseline, setBaseline] = useState<PerformanceSettingsForm>(data.settings);
    const [form, setForm] = useState<PerformanceSettingsForm>(data.settings);
    const { saving, errors, run } = usePanelSave();

    const dirty = useMemo(
        () =>
            (Object.keys(form) as Array<keyof PerformanceSettingsForm>).some(
                (k) => form[k] !== baseline[k],
            ),
        [form, baseline],
    );

    function setField<K extends keyof PerformanceSettingsForm>(key: K, value: PerformanceSettingsForm[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        // The performance update endpoint writes to `.env` (feature
        // toggles + image driver) and defers a config-cache rebuild to
        // the after-response terminating hook so the save round-trip
        // isn't blocked by it. Mirrors PrivacyPanel's error flow: on
        // 422 we throw a SettingsApiError so `run()` populates the
        // panel's `errors` state and the per-field `Field error={...}`
        // props actually render. Falling back to `resolve(false)` would
        // silently fire the success toast on validation failure.
        const ok = await run(async () => {
            await new Promise<void>((resolve, reject) => {
                router.post(admin.settings.performance.update().url, form, {
                    preserveScroll: true,
                    onSuccess: () => resolve(),
                    onError: (bag) => {
                        const errors: ValidationErrors = {};
                        for (const [field, message] of Object.entries(bag)) {
                            errors[field] = [message];
                        }
                        reject(new SettingsApiError('Please review the highlighted fields.', 422, errors));
                    },
                    onCancel: () =>
                        reject(new SettingsApiError('Save cancelled.', 499, {})),
                });
            });
        });
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Performance"
            description="Feature toggles for the artisanpack-ui/performance package. Defaults ship image optimization, page + fragment cache, and RUM enabled; the rest opt in from here."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-4">
                {PERFORMANCE_FEATURE_TOGGLES.map((toggle) => (
                    <Toggle
                        key={toggle.key}
                        checked={Boolean(form[toggle.key])}
                        onChange={(value) => setField(toggle.key, value as PerformanceSettingsForm[typeof toggle.key])}
                        label={toggle.label}
                        description={toggle.description}
                    />
                ))}

                <Field
                    label="Image driver"
                    htmlFor="performance-image-driver"
                    helper="`imagick` is faster and supports AVIF natively; `gd` ships with PHP and is enough for WebP."
                    error={errors['image_driver']?.[0]}
                >
                    <Select
                        id="performance-image-driver"
                        value={form.image_driver}
                        onChange={(value) => setField('image_driver', value)}
                        options={data.drivers.map((driver) => ({ value: driver.value, label: driver.label }))}
                    />
                </Field>

                <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4 text-sm text-base-content/70">
                    <p className="mb-1 font-semibold text-base-content">Current tuning defaults</p>
                    <ul className="list-disc pl-5">
                        <li>Sampling rate: {data.defaults.sampling_rate}%</li>
                        <li>Page cache TTL: {data.defaults.page_cache_ttl}s</li>
                        <li>Fragment cache TTL: {data.defaults.fragment_cache_ttl}s</li>
                    </ul>
                    <p className="mt-2 text-xs">
                        Fine-tune these under <code>config/artisanpack/performance.php</code>; the panel exposes
                        toggles + image driver only.
                    </p>
                </div>
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Developers                                                                 */
/* -------------------------------------------------------------------------- */

function DevelopersPanel({ data }: { data: AdminSettings['developers'] }) {
    const [baseline, setBaseline] = useState(data);
    const [form, setForm] = useState(data);
    const { saving, errors, run } = usePanelSave();

    const dirty =
        form.apiEnabled !== baseline.apiEnabled || form.webhookUrl !== baseline.webhookUrl;

    function set<K extends keyof AdminSettings['developers']>(
        key: K,
        value: AdminSettings['developers'][K],
    ) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function save() {
        const ok = await run(() =>
            saveRegisteredSettings({
                'api.enabled': form.apiEnabled,
                'api.webhookUrl': form.webhookUrl,
            }),
        );
        if (ok) {
            setBaseline(form);
        }
    }

    return (
        <PanelShell
            title="Developers"
            description="API access and webhook delivery."
            saving={saving}
            dirty={dirty}
            onSave={save}
            onCancel={() => setForm(baseline)}
        >
            <div className="flex flex-col gap-5">
                <Toggle
                    checked={form.apiEnabled}
                    onChange={(v) => set('apiEnabled', v)}
                    label="Enable public API"
                    description="Expose the REST API for external integrations."
                />
                <Field
                    label="Webhook URL"
                    htmlFor="webhook-url"
                    helper="Events are POSTed here as JSON."
                    error={errors['settings.api.webhookUrl']?.[0]}
                >
                    <TextInput
                        id="webhook-url"
                        type="url"
                        value={form.webhookUrl}
                        onChange={(v) => set('webhookUrl', v)}
                        placeholder="https://example.com/webhooks/keystone"
                    />
                </Field>
            </div>
        </PanelShell>
    );
}

/* -------------------------------------------------------------------------- */
/* Billing — deferred                                                         */
/* -------------------------------------------------------------------------- */

function BillingPanel() {
    return (
        <Card>
            <div className="border-b border-base-300/60 pb-4">
                <h2 className="font-display text-lg font-semibold text-base-content">Billing</h2>
                <p className="mt-1 text-sm text-base-content/65">
                    Subscription and payment configuration.
                </p>
            </div>
            <div className="grid place-items-center py-16 text-center text-sm text-base-content/55">
                <div>
                    <div className="font-display text-base font-semibold text-base-content">
                        Coming soon
                    </div>
                    <p className="mt-1 max-w-md">
                        Billing settings are deferred until Keystone ships a billing system. This
                        panel is a placeholder, not a broken form.
                    </p>
                </div>
            </div>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type SettingsTab = { key: TabKey; label: string };

function SettingsContent({ settings, options }: SettingsProps) {
    const currentPath = usePage().url.split('?')[0];

    // Filter the visible tab list so a plugin can add / remove / reorder
    // Settings sections without forking the page. Args:
    // `(SettingsTab[], { surface: 'site', currentPath })`. The
    // `surface` discriminator mirrors `SettingsLayout.tsx`'s
    // `{ surface: 'account', … }` so a single subscriber that
    // handles both surfaces can branch on `surface` instead of
    // sniffing item shapes. A plugin returning a `key` not in the
    // built-in TabKey union is ignored by the tabpanel switch below,
    // but the tab still renders in the sidebar (which is what a
    // plugin surfacing a custom section via `.settings.sections`
    // typically wants).
    // Drop the tabs whose panel payload is contributed by a module through
    // the `keystone.admin.settings.panels` filter (see
    // `App\Support\SettingsPanels`) when that module didn't contribute one —
    // its provider never ran, or the module is gone. Missing tab, not a
    // panel rendering against an undefined payload. Runs before the plugin
    // filter below so a subscriber still gets the last word on the list.
    const presentTabs = useMemo(
        () => tabs.filter((t) => {
            switch (t.key) {
                case 'privacy':
                    return undefined !== settings.privacy;
                case 'performance':
                    return undefined !== settings.performance;
                default:
                    return true;
            }
        }),
        [settings],
    );

    const filteredTabs = useMemo(
        () => applyFilters<SettingsTab[]>(
            'keystone.admin.settings.tabs',
            presentTabs,
            { surface: 'site', currentPath },
        ),
        [presentTabs, currentPath],
    );

    const initialTab: TabKey = filteredTabs[0]?.key ?? 'general';
    const [selectedTab, setTab] = useState<TabKey>(initialTab);
    // If a late-registered `.settings.tabs` subscriber removes the
    // currently-selected tab (or the user navigates and the memo
    // re-runs against a different `currentPath`), fall back to the
    // first available tab so the sidebar / panel stay in sync instead
    // of rendering an empty right pane.
    const tab: TabKey = filteredTabs.some((t) => t.key === selectedTab)
        ? selectedTab
        : initialTab;

    // Roving keyboard navigation for the vertical tablist: Up/Down move
    // between tabs (wrapping), Home/End jump to the ends. Without this only
    // the selected tab is reachable (the rest carry tabIndex=-1).
    function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const lastIndex = filteredTabs.length - 1;
        let nextIndex: number | null = null;

        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                nextIndex = index === lastIndex ? 0 : index + 1;
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                nextIndex = index === 0 ? lastIndex : index - 1;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = lastIndex;
                break;
            default:
                return;
        }

        event.preventDefault();
        const nextKey = filteredTabs[nextIndex].key;
        setTab(nextKey);
        document.getElementById(`settings-tab-${nextKey}`)?.focus();
    }

    return (
        <div className="flex flex-col gap-7">
            <PageHeader
                title="Settings"
                description="Configure site, brand, SEO, and developer options."
            />

            <div className="grid grid-cols-12 gap-7">
                <aside className="col-span-12 lg:col-span-3">
                    <Card padded={false}>
                        <ul
                            role="tablist"
                            aria-label="Settings sections"
                            aria-orientation="vertical"
                            className="flex flex-col p-1.5"
                        >
                            {filteredTabs.map((t: SettingsTab, index: number) => (
                                <li key={t.key} role="presentation">
                                    <button
                                        type="button"
                                        role="tab"
                                        id={`settings-tab-${t.key}`}
                                        aria-selected={tab === t.key}
                                        aria-controls={`settings-panel-${t.key}`}
                                        tabIndex={tab === t.key ? 0 : -1}
                                        onClick={() => setTab(t.key)}
                                        onKeyDown={(e) => handleTabKeyDown(e, index)}
                                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${
                                            tab === t.key
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-base-content/75 hover:bg-base-200'
                                        }`}
                                    >
                                        {t.label}
                                        {tab === t.key && (
                                            <span className="text-primary">
                                                {Icon.chevronRight}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </aside>

                <div
                    role="tabpanel"
                    id={`settings-panel-${tab}`}
                    aria-labelledby={`settings-tab-${tab}`}
                    className="col-span-12 lg:col-span-9"
                >
                    {(() => {
                        // Resolve the built-in panel for the active tab
                        // (or `null` when the tab was contributed by a
                        // plugin), then hand it to `.settings.sections`
                        // so a plugin can wrap / decorate the panel or
                        // provide the entire body for a custom tab it
                        // added via `.settings.tabs`. Starting value is
                        // `null` for a plugin-added tab so a subscriber
                        // can render "from scratch" without stripping
                        // an existing built-in. Args:
                        // `(ReactNode, { tab, settings, options })`.
                        let builtIn: ReactNode = null;
                        if (tab === 'general') {
                            builtIn = <GeneralPanel data={settings.general} options={options} />;
                        } else if (tab === 'brand') {
                            builtIn = <BrandPanel data={settings.brand} />;
                        } else if (tab === 'seo') {
                            builtIn = <SeoPanel data={settings.seo} />;
                        } else if (tab === 'discussion') {
                            builtIn = <DiscussionPanel data={settings.discussion} />;
                        } else if (tab === 'permalinks') {
                            builtIn = <PermalinksPanel data={settings.permalinks} />;
                        } else if (tab === 'notifications') {
                            builtIn = <NotificationsPanel data={settings.notifications} />;
                        } else if (tab === 'security') {
                            builtIn = <SecurityPanel data={settings.security} />;
                        } else if (tab === 'privacy' && settings.privacy) {
                            builtIn = <PrivacyPanel data={settings.privacy} />;
                        } else if (tab === 'performance' && settings.performance) {
                            builtIn = <PerformancePanel data={settings.performance} />;
                        } else if (tab === 'developers') {
                            builtIn = <DevelopersPanel data={settings.developers} />;
                        } else if (tab === 'billing') {
                            builtIn = <BillingPanel />;
                        }

                        return applyFilters<ReactNode>(
                            'keystone.admin.settings.sections',
                            builtIn,
                            { surface: 'site', tab, currentPath, settings, options },
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

export default function Settings(props: SettingsProps) {
    return (
        <>
            <Head title="Settings" />
            <ToastProvider>
                <SettingsContent {...props} />
            </ToastProvider>
        </>
    );
}

Settings.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
