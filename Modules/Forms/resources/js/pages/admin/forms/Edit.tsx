import type { ReactNode } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';
import forms from '@/routes/admin/forms';
import { FormBuilder } from '@/vendor/artisanpack-forms/react/components/admin/FormBuilder';

interface EditProps {
    form: {
        id: number;
        name: string;
        slug: string;
    };
}

export default function Edit({ form }: EditProps) {
    return (
        <>
            <Head title={`Edit · ${form.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={form.name}
                    breadcrumbs={['Lead Generation', 'Forms', form.name]}
                    description="Configure fields, notifications, and conditional logic for this form."
                    actions={
                        <Link
                            href={forms.index().url}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content hover:bg-base-200"
                        >
                            ← All forms
                        </Link>
                    }
                />

                <div className="rounded-xl border border-base-300/60 bg-base-100 p-5">
                    <FormBuilder
                        baseUrl="/api/v1/forms"
                        // The package's `formSlug` prop is the route key it
                        // uses to fetch/save the form. Keystone's Route::bind
                        // for `form` accepts numeric IDs, so we pass the id
                        // here — it's stable even if the user renames the
                        // form (which regenerates the slug).
                        formSlug={String(form.id)}
                        onBack={() => router.visit(forms.index().url)}
                        onViewSubmissions={() =>
                            router.visit(forms.submissions.index(form.id).url)
                        }
                    />
                </div>
            </div>
        </>
    );
}

Edit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
