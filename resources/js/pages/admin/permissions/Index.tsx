import type { ReactNode } from 'react';
import { Head, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    DataTable,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';

interface PermissionRow {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    roles: { slug: string; name: string }[];
}

interface PageProps {
    permissions: PermissionRow[];
    [key: string]: unknown;
}

const roleTone: Record<string, Tone> = {
    admin: 'primary',
    site_owner: 'info',
    editor: 'accent',
};

export default function Index() {
    const { permissions } = usePage<PageProps>().props;

    return (
        <>
            <Head title="Permissions" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Permissions"
                    description="Permission slugs are seeded from code. Edit role-permission bindings on the Roles page."
                    breadcrumbs={['Users', 'Permissions']}
                />

                <Card padded={false}>
                    <DataTable<PermissionRow>
                        columns={[
                            {
                                key: 'name',
                                label: 'Permission',
                                render: (p) => (
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-base-content">{p.name}</span>
                                        <code className="text-[11px] text-base-content/55">{p.slug}</code>
                                    </div>
                                ),
                            },
                            {
                                key: 'description',
                                label: 'Description',
                                muted: true,
                                render: (p) => p.description ?? '—',
                            },
                            {
                                key: 'roles',
                                label: 'Granted to',
                                render: (p) =>
                                    p.roles.length === 0 ? (
                                        <span className="text-xs text-base-content/45">No roles</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {p.roles.map((r) => (
                                                <StatusBadge
                                                    key={r.slug}
                                                    label={r.name}
                                                    tone={roleTone[r.slug] ?? 'neutral'}
                                                />
                                            ))}
                                        </div>
                                    ),
                            },
                        ]}
                        rows={permissions}
                    />
                </Card>
            </div>
        </>
    );
}

Index.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
