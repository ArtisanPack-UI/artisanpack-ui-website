import type { ReactNode } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';
import forms from '@/routes/admin/forms';
import { SubmissionDetail as PkgSubmissionDetail } from '@/vendor/artisanpack-forms/react/components/admin/SubmissionDetail';
import type { Form as PkgForm } from '@/vendor/artisanpack-forms/types/artisanpack-forms';

interface Props {
    form: PkgForm;
    submission_id: number;
}

export default function SubmissionDetail({ form, submission_id }: Props) {
    return (
        <>
            <Head title={`Submission #${submission_id} · ${form.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={`Submission #${submission_id}`}
                    breadcrumbs={[
                        'Lead Generation',
                        'Forms',
                        form.name,
                        'Submissions',
                        `#${submission_id}`,
                    ]}
                    actions={
                        <Link
                            href={forms.submissions.index(form.id).url}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content hover:bg-base-200"
                        >
                            ← All submissions
                        </Link>
                    }
                />

                <div className="rounded-xl border border-base-300/60 bg-base-100 p-5">
                    <PkgSubmissionDetail
                        baseUrl="/api/v1/forms"
                        form={form}
                        submissionId={submission_id}
                        onBack={() =>
                            router.visit(forms.submissions.index(form.id).url)
                        }
                    />
                </div>
            </div>
        </>
    );
}

SubmissionDetail.layout = (page: ReactNode) => (
    <KeystoneAdminLayout>{page}</KeystoneAdminLayout>
);
