import type { ReactNode } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { Field, PrimaryButton, TextInput } from '@/components/admin/keystone-form';
import { update as updateRoute } from '@/routes/admin/site-design/business-info';
import type { KeystoneSharedProps } from '@/types/keystone';

interface Address {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
}

interface DayHours {
    open: string;
    close: string;
    closed: boolean;
}

type Hours = Record<DayKey, DayHours>;

interface SocialLink {
    platform: string;
    url: string;
}

interface BusinessInfoPayload {
    business_name: string;
    phone: string;
    email: string;
    address: Address;
    hours: Hours;
    social_links: SocialLink[];
}

interface PageProps extends KeystoneSharedProps {
    business_info: BusinessInfoPayload;
    flash?: { success?: string; error?: string };
    [key: string]: unknown;
}

type DayKey =
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';

const DAYS: ReadonlyArray<{ key: DayKey; label: string }> = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
];

export default function BusinessInfo() {
    const { business_info: initial, flash } = usePage<PageProps>().props;

    const form = useForm<BusinessInfoPayload>({
        business_name: initial.business_name ?? '',
        phone: initial.phone ?? '',
        email: initial.email ?? '',
        address: { ...initial.address },
        hours: { ...initial.hours },
        social_links: [...(initial.social_links ?? [])],
    });

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        form.patch(updateRoute().url, { preserveScroll: true });
    }

    function setAddress<K extends keyof Address>(key: K, value: Address[K]) {
        form.setData('address', { ...form.data.address, [key]: value });
    }

    function setDay(day: DayKey, patch: Partial<DayHours>) {
        form.setData('hours', {
            ...form.data.hours,
            [day]: { ...form.data.hours[day], ...patch },
        });
    }

    function addSocialLink() {
        form.setData('social_links', [
            ...form.data.social_links,
            { platform: '', url: '' },
        ]);
    }

    function updateSocialLink(index: number, patch: Partial<SocialLink>) {
        const next = form.data.social_links.map((entry, idx) =>
            idx === index ? { ...entry, ...patch } : entry,
        );
        form.setData('social_links', next);
    }

    function removeSocialLink(index: number) {
        form.setData(
            'social_links',
            form.data.social_links.filter((_, idx) => idx !== index),
        );
    }

    return (
        <>
            <Head title="Business Info" />
            <form className="flex flex-col gap-7" onSubmit={handleSubmit}>
                <PageHeader
                    title="Business Info"
                    description="The single source of truth for your hours, contact details, and social links. Updates appear everywhere this info is referenced."
                    breadcrumbs={['Site Design', 'Business Info']}
                    actions={
                        <PrimaryButton loading={form.processing}>
                            Save changes
                        </PrimaryButton>
                    }
                />

                {flash?.success ? (
                    <Card className="border-success/30 bg-success/5 text-sm text-success">
                        {flash.success}
                    </Card>
                ) : null}

                <Card>
                    <div className="flex flex-col gap-4">
                        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                            Contact
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field
                                label="Business name"
                                htmlFor="business_name"
                                error={form.errors.business_name}
                            >
                                <TextInput
                                    id="business_name"
                                    value={form.data.business_name}
                                    onChange={(e) => form.setData('business_name', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="Phone"
                                htmlFor="phone"
                                error={form.errors.phone}
                            >
                                <TextInput
                                    id="phone"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="Email"
                                htmlFor="email"
                                error={form.errors.email}
                            >
                                <TextInput
                                    id="email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-col gap-4">
                        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                            Address
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field
                                label="Street"
                                htmlFor="address_street"
                                error={form.errors['address.street' as keyof typeof form.errors] as string | undefined}
                            >
                                <TextInput
                                    id="address_street"
                                    value={form.data.address.street}
                                    onChange={(e) => setAddress('street', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="City"
                                htmlFor="address_city"
                                error={form.errors['address.city' as keyof typeof form.errors] as string | undefined}
                            >
                                <TextInput
                                    id="address_city"
                                    value={form.data.address.city}
                                    onChange={(e) => setAddress('city', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="State / Region"
                                htmlFor="address_state"
                                error={form.errors['address.state' as keyof typeof form.errors] as string | undefined}
                            >
                                <TextInput
                                    id="address_state"
                                    value={form.data.address.state}
                                    onChange={(e) => setAddress('state', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="Postal code"
                                htmlFor="address_postal_code"
                                error={form.errors['address.postal_code' as keyof typeof form.errors] as string | undefined}
                            >
                                <TextInput
                                    id="address_postal_code"
                                    value={form.data.address.postal_code}
                                    onChange={(e) => setAddress('postal_code', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="Country"
                                htmlFor="address_country"
                                error={form.errors['address.country' as keyof typeof form.errors] as string | undefined}
                            >
                                <TextInput
                                    id="address_country"
                                    value={form.data.address.country}
                                    onChange={(e) => setAddress('country', e.target.value)}
                                />
                            </Field>
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-col gap-4">
                        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                            Hours
                        </div>
                        <div className="flex flex-col gap-3">
                            {DAYS.map(({ key, label }) => {
                                const entry = form.data.hours[key];
                                return (
                                    <div
                                        key={key}
                                        className="grid grid-cols-1 items-end gap-3 rounded-lg border border-base-300/40 bg-base-100 p-3 sm:grid-cols-[120px_1fr_1fr_auto]"
                                    >
                                        <div className="text-sm font-semibold text-base-content">
                                            {label}
                                        </div>
                                        <Field label="Open" htmlFor={`hours_${key}_open`}>
                                            <TextInput
                                                id={`hours_${key}_open`}
                                                type="time"
                                                disabled={entry.closed}
                                                value={entry.open}
                                                onChange={(e) => setDay(key, { open: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Close" htmlFor={`hours_${key}_close`}>
                                            <TextInput
                                                id={`hours_${key}_close`}
                                                type="time"
                                                disabled={entry.closed}
                                                value={entry.close}
                                                onChange={(e) => setDay(key, { close: e.target.value })}
                                            />
                                        </Field>
                                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-base-content/80">
                                            <input
                                                type="checkbox"
                                                checked={entry.closed}
                                                onChange={(e) => setDay(key, { closed: e.target.checked })}
                                                className="h-4 w-4 rounded border-base-300/60 text-primary focus:ring-primary"
                                            />
                                            Closed
                                        </label>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>

                <Card>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">
                                Social links
                            </div>
                            <button
                                type="button"
                                onClick={addSocialLink}
                                className="inline-flex items-center gap-1 rounded-lg border border-base-300 bg-base-100 px-3 py-1.5 text-xs font-semibold text-base-content/80 hover:bg-base-200"
                            >
                                Add link
                            </button>
                        </div>
                        {form.data.social_links.length === 0 ? (
                            <p className="text-sm text-base-content/55">
                                No social links yet. Add one to surface it in headers, footers, and schema markup.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {form.data.social_links.map((entry, index) => {
                                    const platformError = form.errors[
                                        `social_links.${index}.platform` as keyof typeof form.errors
                                    ] as string | undefined;
                                    const urlError = form.errors[
                                        `social_links.${index}.url` as keyof typeof form.errors
                                    ] as string | undefined;

                                    return (
                                    <div
                                        key={index}
                                        className="grid grid-cols-1 items-end gap-3 rounded-lg border border-base-300/40 bg-base-100 p-3 sm:grid-cols-[1fr_2fr_auto]"
                                    >
                                        <Field
                                            label="Platform"
                                            htmlFor={`social_${index}_platform`}
                                            error={platformError}
                                        >
                                            <TextInput
                                                id={`social_${index}_platform`}
                                                placeholder="Twitter, Instagram, LinkedIn…"
                                                value={entry.platform}
                                                onChange={(e) => updateSocialLink(index, { platform: e.target.value })}
                                                aria-invalid={platformError ? true : undefined}
                                            />
                                        </Field>
                                        <Field
                                            label="URL"
                                            htmlFor={`social_${index}_url`}
                                            error={urlError}
                                        >
                                            <TextInput
                                                id={`social_${index}_url`}
                                                type="url"
                                                placeholder="https://"
                                                value={entry.url}
                                                onChange={(e) => updateSocialLink(index, { url: e.target.value })}
                                                aria-invalid={urlError ? true : undefined}
                                            />
                                        </Field>
                                        <button
                                            type="button"
                                            onClick={() => removeSocialLink(index)}
                                            className="inline-flex items-center gap-1 self-end rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/70 hover:bg-base-200"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>

                <div className="flex justify-end">
                    <PrimaryButton loading={form.processing}>
                        Save changes
                    </PrimaryButton>
                </div>
            </form>
        </>
    );
}

BusinessInfo.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
