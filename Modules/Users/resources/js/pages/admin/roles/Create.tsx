import type { FormEvent, ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import {
    CheckboxList,
    Field,
    PrimaryButton,
    TextInput,
} from '@/components/admin/keystone-form';
import { index, store } from '@/routes/admin/roles';

interface PermissionOption {
    slug: string;
    name: string;
}

interface CreateProps {
    permissions: PermissionOption[];
}

export default function Create({ permissions }: CreateProps) {
    const form = useForm<{
        name: string;
        slug: string;
        description: string;
        permissions: string[];
    }>({ name: '', slug: '', description: '', permissions: [] });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.post(store().url);
    }

    function togglePermission(slug: string) {
        form.setData(
            'permissions',
            form.data.permissions.includes(slug)
                ? form.data.permissions.filter((p) => p !== slug)
                : [...form.data.permissions, slug],
        );
    }

    const permissionsError =
        form.errors.permissions ??
        Object.entries(form.errors).find(([key]) => key.startsWith('permissions.'))?.[1];

    return (
        <>
            <Head title="New role" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="New role"
                    description="Define a role and choose which permissions it grants."
                    breadcrumbs={['Users', 'Roles', 'New']}
                />

                <form onSubmit={submit} className="flex flex-col gap-5">
                    <Card>
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <Field label="Name" error={form.errors.name} required>
                                <TextInput
                                    name="name"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    required
                                />
                            </Field>
                            <Field
                                label="Slug"
                                error={form.errors.slug}
                                helper="Optional — derived from the name if left blank."
                            >
                                <TextInput
                                    name="slug"
                                    value={form.data.slug}
                                    onChange={(e) => form.setData('slug', e.target.value)}
                                />
                            </Field>
                            <Field label="Description" error={form.errors.description}>
                                <TextInput
                                    name="description"
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                />
                            </Field>
                        </div>
                    </Card>

                    <Card>
                        <div className="mb-3">
                            <h2 className="font-display text-sm font-semibold text-base-content">
                                Permissions
                            </h2>
                            <p className="text-[11px] text-base-content/55">
                                Choose which permissions this role grants.
                            </p>
                        </div>
                        <CheckboxList
                            options={permissions}
                            selected={form.data.permissions}
                            onToggle={togglePermission}
                            error={permissionsError}
                        />
                    </Card>

                    <div className="flex items-center justify-end gap-2">
                        <Link
                            href={index().url}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-4 py-2 text-xs font-semibold text-base-content/80 hover:bg-base-200"
                        >
                            Cancel
                        </Link>
                        <PrimaryButton type="submit" loading={form.processing}>
                            Create role
                        </PrimaryButton>
                    </div>
                </form>
            </div>
        </>
    );
}

Create.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
