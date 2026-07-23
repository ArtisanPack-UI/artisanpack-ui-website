import type { ReactNode } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { formatNumber } from '@/lib/admin/shared';
import forms from '@/routes/admin/forms';
import { SubmissionsList } from '@/vendor/artisanpack-forms/react/components/admin/SubmissionsList';
import type { Form as PkgForm } from '@/vendor/artisanpack-forms/types/artisanpack-forms';

interface FormPicker {
    id: number;
    slug: string;
    name: string;
    submissions: number;
    unread: number;
}

interface SubmissionsProps {
    form: PkgForm | null;
    all_forms: FormPicker[] | null;
}

export default function Submissions({ form, all_forms }: SubmissionsProps) {
    if (form) {
        return (
            <>
                <Head title={`Submissions · ${form.name}`} />
                <div className="flex flex-col gap-7">
                    <PageHeader
                        title="Submissions"
                        breadcrumbs={['Lead Generation', 'Forms', form.name, 'Submissions']}
                        description={`Responses received by "${form.name}".`}
                        actions={
                            <Link
                                href={forms.edit(form.id).url}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content hover:bg-base-200"
                            >
                                Edit form
                            </Link>
                        }
                    />
                    <div className="rounded-xl border border-base-300/60 bg-base-100 p-5">
                        <SubmissionsList
                            baseUrl="/api/v1/forms"
                            form={form}
                            onBack={() => router.visit(forms.index().url)}
                            onViewSubmission={(submission) =>
                                router.visit(
                                    forms.submissions.show([form.id, submission.id]).url,
                                )
                            }
                        />
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="All submissions" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="All submissions"
                    breadcrumbs={['Lead Generation', 'Forms', 'Submissions']}
                    description="Pick a form to view its submissions."
                />
                <Card padded={false}>
                    {!all_forms || all_forms.length === 0 ? (
                        <div className="px-5 py-12 text-center text-sm text-base-content/55">
                            No forms yet.
                        </div>
                    ) : (
                        <ul>
                            {all_forms.map((f) => (
                                <li
                                    key={f.id}
                                    className="flex items-center gap-4 border-b border-base-300/40 px-5 py-4 last:border-b-0 hover:bg-base-200/40"
                                >
                                    <Link
                                        href={forms.submissions.index(f.id).url}
                                        className="flex-1 font-semibold text-base-content hover:text-primary"
                                    >
                                        {f.name}
                                    </Link>
                                    <div className="text-right">
                                        <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-base-content/45">
                                            Submissions
                                        </div>
                                        <div className="font-mono text-sm font-semibold text-base-content">
                                            {formatNumber(f.submissions)}
                                            {f.unread > 0 && (
                                                <span className="ml-2 inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                                                    {f.unread} new
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </>
    );
}

Submissions.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
