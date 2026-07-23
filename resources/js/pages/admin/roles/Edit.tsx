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
import { index, update } from '@/routes/admin/roles';

interface PermissionOption {
    slug: string;
    name: string;
}

interface EditProps {
    role: {
        id: number;
        name: string;
        slug: string;
        description: string | null;
        permissions: string[];
    };
    permissions: PermissionOption[];
}

const BUILT_IN = ['admin', 'site_owner', 'editor'];

export default function Edit({ role, permissions }: EditProps) {
    const isBuiltIn = BUILT_IN.includes(role.slug);
    const form = useForm<{
        name: string;
        slug: string;
        description: string;
        permissions: string[];
    }>({
        name: role.name,
        slug: role.slug,
        description: role.description ?? '',
        permissions: role.permissions,
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.put(update(role.id).url);
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
            <Head title={`Edit ${role.name}`} />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title={`Edit ${role.name}`}
                    description="Update the role's metadata and permissions."
                    breadcrumbs={['Users', 'Roles', role.name]}
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
                                helper={isBuiltIn ? 'Built-in role slugs cannot be changed.' : undefined}
                                required
                            >
                                <TextInput
                                    name="slug"
                                    value={form.data.slug}
                                    onChange={(e) => form.setData('slug', e.target.value)}
                                    disabled={isBuiltIn}
                                    required
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
                            Save changes
                        </PrimaryButton>
                    </div>
                </form>
            </div>
        </>
    );
}

Edit.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
