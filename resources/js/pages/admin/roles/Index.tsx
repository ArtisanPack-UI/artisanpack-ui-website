import type { ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    DataTable,
    Icon,
    PageHeader,
    StatusBadge,
} from '@/components/admin/keystone';
import { create, destroy, edit } from '@/routes/admin/roles';

interface RoleRow {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    permission_count: number;
}

interface PageProps {
    roles: RoleRow[];
    flash: { success?: string; error?: string };
    [key: string]: unknown;
}

const BUILT_IN = ['admin', 'site_owner', 'editor'];

export default function Index() {
    const { roles, flash } = usePage<PageProps>().props;

    function deleteRole(role: RoleRow) {
        if (!confirm(`Delete role ${role.name}?`)) return;
        router.delete(destroy(role.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Roles" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Roles"
                    description="Group permissions into roles and assign them to users."
                    breadcrumbs={['Users', 'Roles']}
                    actions={
                        <Link
                            href={create().url}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary/90"
                        >
                            {Icon.plus}
                            New role
                        </Link>
                    }
                />

                {flash.success && (
                    <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="rounded-lg border border-error/30 bg-error/10 px-4 py-2 text-sm text-error">
                        {flash.error}
                    </div>
                )}

                <Card padded={false}>
                    <DataTable<RoleRow>
                        resource="roles"
                        columns={[
                            {
                                key: 'name',
                                label: 'Role',
                                render: (r) => (
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-base-content">{r.name}</span>
                                        <code className="text-[11px] text-base-content/55">{r.slug}</code>
                                    </div>
                                ),
                            },
                            {
                                key: 'description',
                                label: 'Description',
                                muted: true,
                                render: (r) => r.description ?? '—',
                            },
                            {
                                key: 'permission_count',
                                label: 'Permissions',
                                render: (r) => (
                                    <StatusBadge
                                        label={`${r.permission_count} ${r.permission_count === 1 ? 'permission' : 'permissions'}`}
                                        tone="neutral"
                                    />
                                ),
                            },
                            {
                                key: 'built_in',
                                label: '',
                                render: (r) =>
                                    BUILT_IN.includes(r.slug) ? (
                                        <StatusBadge label="Built-in" tone="info" />
                                    ) : null,
                            },
                            {
                                key: 'actions',
                                label: '',
                                align: 'right',
                                render: (r) => (
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={edit(r.id).url}
                                            className="rounded-md px-2 py-1 text-xs font-semibold text-base-content/70 hover:bg-base-200 hover:text-base-content"
                                        >
                                            Edit
                                        </Link>
                                        {!BUILT_IN.includes(r.slug) && (
                                            <button
                                                type="button"
                                                onClick={() => deleteRole(r)}
                                                className="rounded-md px-2 py-1 text-xs font-semibold text-error/80 hover:bg-error/10 hover:text-error"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                        rows={roles}
                    />
                </Card>
            </div>
        </>
    );
}

Index.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
