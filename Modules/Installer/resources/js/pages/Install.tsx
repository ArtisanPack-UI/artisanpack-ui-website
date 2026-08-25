import type { ReactNode } from 'react';
import { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button, Input, Password, Select } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';
import install from '@/routes/install';

interface SiteTypeOption {
    value: string;
    label: string;
}

interface InstallStep {
    step: string;
    status: 'ok' | 'skipped' | 'failed' | string;
    detail: string | null;
}

interface InstallResult {
    success: boolean;
    steps: InstallStep[];
    failed_steps: string[];
    admin_email: string;
    admin_password: string | null;
    site_owner_password: string | null;
    primary_domain: string;
}

interface InstallProps {
    siteTypes: SiteTypeOption[];
    defaults: { site_type: string };
    result?: InstallResult;
}

interface InstallFormData {
    site_type: string;
    business_name: string;
    primary_domain: string;
    admin_name: string;
    admin_email: string;
    admin_password: string;
    auto_generate_password: boolean;
    site_owner_email: string;
    theme_zip_path: string;
    cloudflare_zone_id: string;
    [key: string]: string | boolean;
}

const STEP_LABELS = ['Site', 'Admin', 'Extras', 'Review'] as const;
type StepIndex = 0 | 1 | 2 | 3;

/**
 * Which wizard step owns each field the server can reject, in step order.
 *
 * The submit happens from the review step, which renders no inputs — so a 422
 * that leaves the user sitting there shows them nothing at all, even though
 * every field already wires up its own `error` prop. `canAdvance()` only
 * checks presence and password length, so anything the server validates more
 * strictly (email format, `max:255`, the `site_type` allowlist) reaches the
 * request and comes back invisible. `submit()` uses this to jump back to the
 * first offending step.
 */
const STEP_FIELDS: ReadonlyArray<ReadonlyArray<keyof InstallFormData>> = [
    ['site_type', 'business_name', 'primary_domain'],
    ['admin_name', 'admin_email', 'admin_password'],
    ['site_owner_email', 'theme_zip_path', 'cloudflare_zone_id'],
];

/**
 * The earliest step holding a rejected field, or null if the errors are all
 * for fields no step renders (in which case moving the user would only hide
 * the review summary without showing them a cause).
 */
function firstStepWithError(
    errors: Partial<Record<keyof InstallFormData, string>>,
): StepIndex | null {
    const index = STEP_FIELDS.findIndex((fields) => fields.some((field) => errors[field]));

    return index === -1 ? null : (index as StepIndex);
}

const STEP_STATUS_ICON: Record<string, string> = {
    ok: '✓',
    skipped: '○',
    failed: '✗',
};

export default function Install({ siteTypes, defaults, result }: InstallProps) {
    const [step, setStep] = useState<StepIndex>(0);

    const form = useForm<InstallFormData>({
        site_type: defaults.site_type || 'sbdf_pro',
        business_name: '',
        primary_domain: '',
        admin_name: '',
        admin_email: '',
        admin_password: '',
        auto_generate_password: true,
        site_owner_email: '',
        theme_zip_path: '',
        cloudflare_zone_id: '',
    });

    // The initial GET was already authorized by the install token in the
    // URL; the controller stamps a session grant that the middleware accepts
    // for this POST, so we don't carry the token in the POST target where it
    // would show up in logs on every submit.
    const submitUrl = install.store.url();

    function next() {
        setStep((current) => Math.min(3, current + 1) as StepIndex);
    }

    function back() {
        setStep((current) => Math.max(0, current - 1) as StepIndex);
    }

    function canAdvance(): boolean {
        if (step === 0) {
            return (
                form.data.site_type.trim() !== '' &&
                form.data.business_name.trim() !== '' &&
                form.data.primary_domain.trim() !== ''
            );
        }
        if (step === 1) {
            const passwordOk =
                form.data.auto_generate_password ||
                form.data.admin_password.trim().length >= 8;
            return (
                form.data.admin_name.trim() !== '' &&
                form.data.admin_email.trim() !== '' &&
                passwordOk
            );
        }
        return true;
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();

        const payload = {
            site_type: form.data.site_type,
            business_name: form.data.business_name,
            primary_domain: form.data.primary_domain,
            admin_name: form.data.admin_name,
            admin_email: form.data.admin_email,
            admin_password: form.data.auto_generate_password
                ? ''
                : form.data.admin_password,
            site_owner_email: form.data.site_owner_email,
            theme_zip_path: form.data.theme_zip_path,
            cloudflare_zone_id: form.data.cloudflare_zone_id,
        };

        form.transform(() => payload);
        form.post(submitUrl, {
            preserveScroll: true,
            // Keep `?token=` in the address bar. Inertia's default is to
            // rewrite the URL to the POST target, which drops the token — and
            // `installed:guard` demands it on every safe request, so the
            // failure screen's own "reload this page to retry" instruction
            // would hand the operator a 403. Nothing is newly exposed: the
            // token is already in the address bar from the initial GET, and
            // this does not put it on the POST itself. On success it stops
            // mattering — the flag is written and `/install` 404s before the
            // token is ever compared.
            preserveUrl: true,
            onError: (errors) => {
                const offending = firstStepWithError(errors);

                if (null !== offending) {
                    setStep(offending);
                }
            },
        });
    }

    if (result) {
        return (
            <>
                <Head title={result.success ? 'Install complete' : 'Install failed'} />
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body gap-4">
                        <h1 className="card-title justify-center">
                            {result.success ? 'Site installed' : 'Install incomplete'}
                        </h1>

                        {result.success ? (
                            <div className="alert alert-success text-sm">
                                Your site is ready. The install token has been rotated —
                                this page will no longer be reachable.
                            </div>
                        ) : (
                            <div className="alert alert-error text-sm">
                                The installer reported failures:{' '}
                                {result.failed_steps.join(', ') || 'unknown'}. Partial
                                progress is preserved — fix the cause and reload this page
                                to retry.
                            </div>
                        )}

                        <StepReport steps={result.steps} />

                        {result.success && (
                            <Credentials
                                adminEmail={result.admin_email}
                                adminPassword={result.admin_password}
                                siteOwnerPassword={result.site_owner_password}
                                primaryDomain={result.primary_domain}
                            />
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Install Keystone" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body gap-4">
                    <h1 className="card-title justify-center">Install Keystone</h1>
                    <Progress current={step} />

                    <form onSubmit={submit} className="flex flex-col gap-4">
                        {step === 0 && (
                            <SiteStep
                                form={form}
                                siteTypes={siteTypes}
                            />
                        )}
                        {step === 1 && <AdminStep form={form} />}
                        {step === 2 && <ExtrasStep form={form} />}
                        {step === 3 && <ReviewStep form={form} siteTypes={siteTypes} />}

                        <div className="flex items-center justify-between mt-2">
                            <Button
                                type="button"
                                color="ghost"
                                onClick={back}
                                disabled={step === 0 || form.processing}
                            >
                                Back
                            </Button>
                            {step < 3 ? (
                                <Button
                                    type="button"
                                    color="primary"
                                    onClick={next}
                                    disabled={!canAdvance()}
                                >
                                    Next
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    color="primary"
                                    loading={form.processing}
                                >
                                    Install
                                </Button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

Install.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;

function Progress({ current }: { current: StepIndex }) {
    return (
        <ul className="steps steps-horizontal text-xs">
            {STEP_LABELS.map((label, index) => (
                <li
                    key={label}
                    className={`step ${index <= current ? 'step-primary' : ''}`}
                >
                    {label}
                </li>
            ))}
        </ul>
    );
}

interface StepProps {
    form: ReturnType<typeof useForm<InstallFormData>>;
}

function SiteStep({ form, siteTypes }: StepProps & { siteTypes: SiteTypeOption[] }) {
    return (
        <>
            <Select
                name="site_type"
                label="Site type"
                value={form.data.site_type}
                error={form.errors.site_type}
                onChange={(e) => form.setData('site_type', e.target.value)}
                options={siteTypes.map((option) => ({
                    id: option.value,
                    name: option.label,
                }))}
                required
            />
            <Input
                name="business_name"
                label="Business name"
                value={form.data.business_name}
                error={form.errors.business_name}
                onChange={(e) => form.setData('business_name', e.target.value)}
                required
            />
            <Input
                name="primary_domain"
                label="Primary domain"
                value={form.data.primary_domain}
                error={form.errors.primary_domain}
                onChange={(e) => form.setData('primary_domain', e.target.value)}
                hint="e.g. acmebistro.com — no scheme, no trailing slash."
                required
            />
        </>
    );
}

function AdminStep({ form }: StepProps) {
    return (
        <>
            <Input
                name="admin_name"
                label="Admin name"
                value={form.data.admin_name}
                error={form.errors.admin_name}
                onChange={(e) => form.setData('admin_name', e.target.value)}
                autoComplete="name"
                required
            />
            <Input
                name="admin_email"
                label="Admin email"
                type="email"
                value={form.data.admin_email}
                error={form.errors.admin_email}
                onChange={(e) => form.setData('admin_email', e.target.value)}
                autoComplete="email"
                required
            />
            <label className="label cursor-pointer justify-start gap-3">
                <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={form.data.auto_generate_password}
                    onChange={(e) =>
                        form.setData('auto_generate_password', e.target.checked)
                    }
                />
                <span className="label-text">
                    Generate a random admin password (shown once after install)
                </span>
            </label>
            {!form.data.auto_generate_password && (
                <Password
                    name="admin_password"
                    label="Admin password"
                    value={form.data.admin_password}
                    error={form.errors.admin_password}
                    onChange={(e) => form.setData('admin_password', e.target.value)}
                    autoComplete="new-password"
                    hint="At least 8 characters."
                    required
                />
            )}
        </>
    );
}

function ExtrasStep({ form }: StepProps) {
    return (
        <>
            <Input
                name="site_owner_email"
                label="Site owner email (optional)"
                type="email"
                value={form.data.site_owner_email}
                error={form.errors.site_owner_email}
                onChange={(e) => form.setData('site_owner_email', e.target.value)}
                hint="Creates a second user with the site_owner role. Leave blank to skip."
            />
            <Input
                name="theme_zip_path"
                label="Theme zip path (optional)"
                value={form.data.theme_zip_path}
                error={form.errors.theme_zip_path}
                onChange={(e) => form.setData('theme_zip_path', e.target.value)}
                hint="Absolute path to a theme .zip on the server. Leave blank to skip."
            />
            <Input
                name="cloudflare_zone_id"
                label="Cloudflare zone ID (optional)"
                value={form.data.cloudflare_zone_id}
                error={form.errors.cloudflare_zone_id}
                onChange={(e) => form.setData('cloudflare_zone_id', e.target.value)}
            />
        </>
    );
}

function ReviewStep({
    form,
    siteTypes,
}: StepProps & { siteTypes: SiteTypeOption[] }) {
    const siteTypeLabel =
        siteTypes.find((siteType) => siteType.value === form.data.site_type)?.label ??
        form.data.site_type;

    return (
        <dl className="divide-y divide-base-300/60 text-sm">
            <ReviewRow label="Site type" value={siteTypeLabel} />
            <ReviewRow label="Business name" value={form.data.business_name} />
            <ReviewRow label="Primary domain" value={form.data.primary_domain} />
            <ReviewRow label="Admin name" value={form.data.admin_name} />
            <ReviewRow label="Admin email" value={form.data.admin_email} />
            <ReviewRow
                label="Admin password"
                value={form.data.auto_generate_password ? 'auto-generated' : '••••••••'}
            />
            <ReviewRow
                label="Site owner email"
                value={form.data.site_owner_email || '— skip —'}
            />
            <ReviewRow
                label="Theme zip"
                value={form.data.theme_zip_path || '— skip —'}
            />
            <ReviewRow
                label="Cloudflare zone"
                value={form.data.cloudflare_zone_id || '— skip —'}
            />
        </dl>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-base-content/70">{label}</dt>
            <dd className="text-right font-medium break-all">{value}</dd>
        </div>
    );
}

function StepReport({ steps }: { steps: InstallStep[] }) {
    return (
        <ol className="flex flex-col gap-1 text-sm font-mono">
            {steps.map((step, index) => (
                <li key={index} className="flex gap-2">
                    <span aria-hidden="true">
                        {STEP_STATUS_ICON[step.status] ?? '·'}
                    </span>
                    <span className="w-24 text-base-content/70">{step.step}</span>
                    <span>{step.status}</span>
                    {step.detail && (
                        <span className="text-base-content/60">— {step.detail}</span>
                    )}
                </li>
            ))}
        </ol>
    );
}

interface CredentialsProps {
    adminEmail: string;
    adminPassword: string | null;
    siteOwnerPassword: string | null;
    primaryDomain: string;
}

function Credentials({
    adminEmail,
    adminPassword,
    siteOwnerPassword,
    primaryDomain,
}: CredentialsProps) {
    const adminUrl = primaryDomain
        ? `https://${primaryDomain}/admin`
        : '/admin';

    return (
        <div className="flex flex-col gap-3">
            {adminPassword && (
                <div className="alert alert-warning text-sm">
                    <div>
                        <p className="font-semibold">Admin password (shown once)</p>
                        <p className="font-mono break-all">{adminPassword}</p>
                        <p className="text-xs mt-1">
                            Account: <span className="font-mono">{adminEmail}</span>
                        </p>
                    </div>
                </div>
            )}
            {siteOwnerPassword && (
                <div className="alert alert-warning text-sm">
                    <div>
                        <p className="font-semibold">
                            Site owner password (shown once)
                        </p>
                        <p className="font-mono break-all">{siteOwnerPassword}</p>
                    </div>
                </div>
            )}
            <a href={adminUrl} className="btn btn-primary w-full">
                Go to admin
            </a>
        </div>
    );
}
