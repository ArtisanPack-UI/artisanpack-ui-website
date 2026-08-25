import type { ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Avatar } from '@artisanpack-ui/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import {
    Card,
    DataTable,
    Icon,
    PageHeader,
    StatusBadge,
    type Tone,
} from '@/components/admin/keystone';
import { create, destroy, edit } from '@/routes/admin/users';

interface RoleRef {
    slug: string;
    name: string;
}

interface AdminUser {
    id: number;
    username: string;
    display_name: string;
    email: string;
    initials: string;
    profile_photo_url: string | null;
    roles: RoleRef[];
}

interface PageProps {
    users: AdminUser[];
    flash: { success?: string; error?: string };
    [key: string]: unknown;
}

const roleTone: Record<string, Tone> = {
    admin: 'primary',
    site_owner: 'info',
    editor: 'accent',
};

export default function Index() {
    const { users, flash } = usePage<PageProps>().props;

    function deleteUser(user: AdminUser) {
        if (!confirm(`Delete ${user.display_name}?`)) return;
        router.delete(destroy(user.id).url, { preserveScroll: true });
    }

    return (
        <>
            <Head title="Users" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Users"
                    description="Team members with access to this site."
                    actions={
                        <Link
                            href={create().url}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover"
                        >
                            {Icon.plus}
                            New user
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
                    <DataTable<AdminUser>
                        resource="users"
                        columns={[
                            {
                                key: 'display_name',
                                label: 'User',
                                render: (u) => (
                                    <div className="flex items-center gap-3">
                                        <Avatar
                                            image={u.profile_photo_url ?? undefined}
                                            placeholder={u.initials}
                                            alt={u.display_name}
                                            color="primary"
                                            size="sm"
                                        />
                                        <div>
                                            <div className="font-semibold text-base-content">{u.display_name}</div>
                                            <div className="text-[11px] text-base-content/55">
                                                @{u.username} · {u.email}
                                            </div>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'roles',
                                label: 'Roles',
                                render: (u) =>
                                    u.roles.length === 0 ? (
                                        <span className="text-xs text-base-content/45">No roles</span>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {u.roles.map((r) => (
                                                <StatusBadge
                                                    key={r.slug}
                                                    label={r.name}
                                                    tone={roleTone[r.slug] ?? 'neutral'}
                                                />
                                            ))}
                                        </div>
                                    ),
                            },
                            {
                                key: 'actions',
                                label: '',
                                align: 'right',
                                render: (u) => (
                                    <div className="flex items-center justify-end gap-1">
                                        <Link
                                            href={edit(u.id).url}
                                            className="rounded-md px-2 py-1 text-xs font-semibold text-base-content/70 hover:bg-base-200 hover:text-base-content"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => deleteUser(u)}
                                            className="rounded-md px-2 py-1 text-xs font-semibold text-error/80 hover:bg-error/10 hover:text-error"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                ),
                            },
                        ]}
                        rows={users}
                    />
                </Card>
            </div>
        </>
    );
}

Index.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
