import { useMemo, type FormEvent, type ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { applyFilters } from '@artisanpack-ui/hooks-js';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import {
    Field,
    PrimaryButton,
    TextInput,
} from '@/components/admin/keystone-form';
import { index, update } from '@/routes/admin/roles';

interface PermissionOption {
    slug: string;
    name: string;
    description?: string | null;
}

interface PermissionGroup {
    /** Group heading shown above its items. `null` renders as a plain list. */
    label: string | null;
    items: PermissionOption[];
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

    // Group the flat permission list before rendering. The built-in
    // shape is a single unlabeled group; `.roles.permissions.groups`
    // lets a plugin split by prefix (e.g. `posts.*` → "Posts") or
    // hide entire clusters behind a feature flag. Args:
    // `(PermissionGroup[], { role, permissions })`.
    const groups = useMemo(
        () => applyFilters<PermissionGroup[]>(
            'keystone.admin.roles.permissions.groups',
            [{ label: null, items: permissions }],
            { role, permissions },
        ),
        [permissions, role],
    );

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
                        <div>
                            <div className="flex max-h-96 flex-col gap-4 overflow-y-auto rounded-lg border border-base-300/60 bg-base-100 p-3">
                                {groups.length === 0 && (
                                    <span className="text-xs text-base-content/45">No options available.</span>
                                )}
                                {groups.map((group: PermissionGroup, groupIndex: number) => (
                                    <div key={group.label ?? `group-${groupIndex}`} className="flex flex-col gap-2">
                                        {group.label && (
                                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-base-content/55">
                                                {group.label}
                                            </h3>
                                        )}
                                        {group.items.map((opt: PermissionOption) => {
                                            const isSelected = form.data.permissions.includes(opt.slug);
                                            // Default row body — checkbox + name/slug + description.
                                            // `.roles.permissions.row` wraps this so a plugin can
                                            // hide a permission, insert a "Recommended" pill, or
                                            // swap the entire row for a plugin-owned control. Return
                                            // `null` to drop the row silently. Args: `(ReactNode,
                                            // { permission, group, selected, toggle })`.
                                            const rowBody: ReactNode = (
                                                <label
                                                    className="flex cursor-pointer items-start gap-3 rounded-md px-1 py-1 hover:bg-base-200/60"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => togglePermission(opt.slug)}
                                                        className="mt-0.5 h-4 w-4 rounded border-base-300/60 text-primary focus:ring-primary"
                                                    />
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-medium text-base-content">
                                                            {opt.name}{' '}
                                                            <code className="text-[11px] font-normal text-base-content/55">
                                                                {opt.slug}
                                                            </code>
                                                        </span>
                                                        {opt.description && (
                                                            <span className="block text-[11px] text-base-content/55">
                                                                {opt.description}
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>
                                            );

                                            const filteredRow = applyFilters<ReactNode>(
                                                'keystone.admin.roles.permissions.row',
                                                rowBody,
                                                {
                                                    permission: opt,
                                                    group,
                                                    selected: isSelected,
                                                    toggle: () => togglePermission(opt.slug),
                                                },
                                            );

                                            if (filteredRow === null) {
                                                return null;
                                            }
                                            return <div key={opt.slug}>{filteredRow}</div>;
                                        })}
                                    </div>
                                ))}
                            </div>
                            {permissionsError && <p className="mt-1.5 text-[11px] text-error">{permissionsError}</p>}
                        </div>
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
