import { useMemo, type FormEvent, type ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import {
    CheckboxList,
    Field,
    PrimaryButton,
    TextInput,
} from '@/components/admin/keystone-form';
import FeaturedImagePicker, {
    type FeaturedImageRecord,
} from '@/components/admin/FeaturedImagePicker';
import { displayNameCandidatesFrom } from '@/lib/admin/displayName';
import { index, store } from '@/routes/admin/users';

interface RoleOption {
    slug: string;
    name: string;
}

interface CreateProps {
    assignableRoles: RoleOption[];
}

interface CreateForm {
    first_name: string;
    last_name: string;
    username: string;
    nickname: string;
    display_name: string;
    email: string;
    password: string;
    profile_photo: FeaturedImageRecord | null;
    roles: string[];
}

export default function Create({ assignableRoles }: CreateProps) {
    const form = useForm<CreateForm>({
        first_name: '',
        last_name: '',
        username: '',
        nickname: '',
        display_name: '',
        email: '',
        password: '',
        profile_photo: null,
        roles: [],
    });

    const displayCandidates = useMemo(
        () =>
            displayNameCandidatesFrom({
                first_name: form.data.first_name,
                last_name: form.data.last_name,
                nickname: form.data.nickname,
                username: form.data.username,
            }),
        [form.data.first_name, form.data.last_name, form.data.nickname, form.data.username],
    );

    function submit(e: FormEvent) {
        e.preventDefault();
        form.transform((data) => {
            const { profile_photo: photo, ...rest } = data;
            return { ...rest, profile_photo_id: photo?.id ?? null };
        });
        form.post(store().url);
    }

    function toggleRole(slug: string) {
        form.setData(
            'roles',
            form.data.roles.includes(slug)
                ? form.data.roles.filter((r) => r !== slug)
                : [...form.data.roles, slug],
        );
    }

    const rolesError =
        form.errors.roles ??
        Object.entries(form.errors).find(([key]) => key.startsWith('roles.'))?.[1];

    return (
        <>
            <Head title="New user" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="New user"
                    description="Invite a new team member and assign their roles."
                    breadcrumbs={['Users', 'New user']}
                />

                <form onSubmit={submit} className="flex flex-col gap-5">
                    <Card>
                        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <Field label="First name" error={form.errors.first_name}>
                                <TextInput
                                    name="first_name"
                                    value={form.data.first_name}
                                    onChange={(e) => form.setData('first_name', e.target.value)}
                                    autoComplete="given-name"
                                />
                            </Field>
                            <Field label="Last name" error={form.errors.last_name}>
                                <TextInput
                                    name="last_name"
                                    value={form.data.last_name}
                                    onChange={(e) => form.setData('last_name', e.target.value)}
                                    autoComplete="family-name"
                                />
                            </Field>
                            <Field
                                label="Username"
                                error={form.errors.username}
                                helper="Letters, numbers, dot, hyphen, underscore. Used for login."
                                required
                            >
                                <TextInput
                                    name="username"
                                    value={form.data.username}
                                    onChange={(e) => form.setData('username', e.target.value)}
                                    autoComplete="username"
                                    required
                                />
                            </Field>
                            <Field label="Nickname" error={form.errors.nickname}>
                                <TextInput
                                    name="nickname"
                                    value={form.data.nickname}
                                    onChange={(e) => form.setData('nickname', e.target.value)}
                                />
                            </Field>
                            <Field
                                label="Display name"
                                error={form.errors.display_name}
                                helper="How this user's name appears on the public site."
                                required
                            >
                                {displayCandidates.length > 0 ? (
                                    <select
                                        value={form.data.display_name}
                                        onChange={(e) => form.setData('display_name', e.target.value)}
                                        className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                        required
                                    >
                                        {!displayCandidates.includes(form.data.display_name) && (
                                            <option value={form.data.display_name}>
                                                {form.data.display_name || 'Select a display name…'}
                                            </option>
                                        )}
                                        {displayCandidates.map((candidate) => (
                                            <option key={candidate} value={candidate}>
                                                {candidate}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <TextInput
                                        name="display_name"
                                        value={form.data.display_name}
                                        onChange={(e) => form.setData('display_name', e.target.value)}
                                        required
                                    />
                                )}
                            </Field>
                            <Field label="Email" error={form.errors.email} required>
                                <TextInput
                                    type="email"
                                    name="email"
                                    value={form.data.email}
                                    onChange={(e) => form.setData('email', e.target.value)}
                                    required
                                />
                            </Field>
                            <Field
                                label="Password"
                                error={form.errors.password}
                                helper="Minimum 8 characters."
                                required
                            >
                                <TextInput
                                    type="password"
                                    name="password"
                                    value={form.data.password}
                                    onChange={(e) => form.setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </Field>
                        </div>
                    </Card>

                    <Card>
                        <div className="mb-3">
                            <h2 className="font-display text-sm font-semibold text-base-content">
                                Profile photo
                            </h2>
                            <p className="text-[11px] text-base-content/55">
                                Optional. Falls back to the initials avatar when blank.
                            </p>
                        </div>
                        <FeaturedImagePicker
                            value={form.data.profile_photo}
                            onChange={(value) => form.setData('profile_photo', value)}
                            context="user-profile-photo"
                            placeholderLabel="+ Set profile photo"
                            modalTitle="Choose a profile photo"
                        />
                        {/* Server returns errors keyed by `profile_photo_id` because we
                            rename the field in `transform()`; bracket-cast since
                            useForm's error type only knows the pre-transform keys. */}
                        {(form.errors as Record<string, string | undefined>).profile_photo_id && (
                            <p className="mt-2 text-[11px] text-error">
                                {(form.errors as Record<string, string | undefined>).profile_photo_id}
                            </p>
                        )}
                    </Card>

                    <Card>
                        <div className="mb-3">
                            <h2 className="font-display text-sm font-semibold text-base-content">Roles</h2>
                            <p className="text-[11px] text-base-content/55">
                                Roles control what this user can access in the admin.
                            </p>
                        </div>
                        <CheckboxList
                            options={assignableRoles}
                            selected={form.data.roles}
                            onToggle={toggleRole}
                            error={rolesError}
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
                            Create user
                        </PrimaryButton>
                    </div>
                </form>
            </div>
        </>
    );
}

Create.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
