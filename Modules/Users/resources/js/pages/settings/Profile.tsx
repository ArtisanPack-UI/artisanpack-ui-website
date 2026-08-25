import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import {
    DangerButton,
    Field,
    PrimaryButton,
    TextInput,
} from '@/components/admin/keystone-form';
import FeaturedImagePicker, {
    type FeaturedImageRecord,
} from '@/components/admin/FeaturedImagePicker';
import { displayNameCandidatesFrom } from '@/lib/admin/displayName';
import { destroy as destroyProfile, update as updateProfile } from '@/routes/admin/profile';
import { send as sendVerification } from '@/routes/verification';

interface AuthUser {
    email: string;
    email_verified_at: string | null;
}

interface SharedProps {
    auth: { user: AuthUser };
    flash: { success?: string };
    [key: string]: unknown;
}

interface ProfilePayload {
    first_name: string | null;
    last_name: string | null;
    username: string;
    nickname: string | null;
    display_name: string;
    email: string;
    profile_photo: FeaturedImageRecord | null;
}

interface ProfileProps {
    profile: ProfilePayload;
    mustVerifyEmail: boolean;
    status?: string;
}

interface ProfileForm {
    first_name: string;
    last_name: string;
    username: string;
    nickname: string;
    display_name: string;
    email: string;
    profile_photo: FeaturedImageRecord | null;
}

export default function Profile({ profile, mustVerifyEmail, status }: ProfileProps) {
    const { auth, flash } = usePage<SharedProps>().props;

    const profileForm = useForm<ProfileForm>({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        username: profile.username,
        nickname: profile.nickname ?? '',
        display_name: profile.display_name,
        email: profile.email,
        profile_photo: profile.profile_photo,
    });

    const displayCandidates = useMemo(
        () =>
            displayNameCandidatesFrom({
                first_name: profileForm.data.first_name,
                last_name: profileForm.data.last_name,
                nickname: profileForm.data.nickname,
                username: profileForm.data.username,
            }),
        [
            profileForm.data.first_name,
            profileForm.data.last_name,
            profileForm.data.nickname,
            profileForm.data.username,
        ],
    );

    const deleteForm = useForm({ password: '' });
    const [deleteOpen, setDeleteOpen] = useState(false);

    function submitProfile(e: FormEvent) {
        e.preventDefault();
        profileForm.transform((data) => {
            const { profile_photo: photo, ...rest } = data;
            return { ...rest, profile_photo_id: photo?.id ?? null };
        });
        profileForm.patch(updateProfile().url, { preserveScroll: true });
    }

    function submitDelete(e: FormEvent) {
        e.preventDefault();
        deleteForm.delete(destroyProfile().url, {
            preserveScroll: true,
            onError: () => deleteForm.reset('password'),
        });
    }

    return (
        <>
            <Head title="Profile" />

            <PageHeader
                title="Profile"
                description="Update your name, username, display name, and profile photo."
            />

            {flash.success && (
                <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                    {flash.success}
                </div>
            )}

            <form onSubmit={submitProfile}>
                <Card>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <Field label="First name" error={profileForm.errors.first_name}>
                            <TextInput
                                name="first_name"
                                value={profileForm.data.first_name}
                                onChange={(e) => profileForm.setData('first_name', e.target.value)}
                                autoComplete="given-name"
                            />
                        </Field>
                        <Field label="Last name" error={profileForm.errors.last_name}>
                            <TextInput
                                name="last_name"
                                value={profileForm.data.last_name}
                                onChange={(e) => profileForm.setData('last_name', e.target.value)}
                                autoComplete="family-name"
                            />
                        </Field>
                        <Field
                            label="Username"
                            error={profileForm.errors.username}
                            helper="Letters, numbers, dot, hyphen, underscore. Used for login."
                            required
                        >
                            <TextInput
                                name="username"
                                value={profileForm.data.username}
                                onChange={(e) => profileForm.setData('username', e.target.value)}
                                autoComplete="username"
                                required
                            />
                        </Field>
                        <Field label="Nickname" error={profileForm.errors.nickname}>
                            <TextInput
                                name="nickname"
                                value={profileForm.data.nickname}
                                onChange={(e) => profileForm.setData('nickname', e.target.value)}
                            />
                        </Field>
                        <Field
                            label="Display name"
                            error={profileForm.errors.display_name}
                            helper="How your name appears on the public site."
                            required
                        >
                            {displayCandidates.length > 0 ? (
                                <select
                                    value={profileForm.data.display_name}
                                    onChange={(e) =>
                                        profileForm.setData('display_name', e.target.value)
                                    }
                                    className="h-9 w-full rounded-md border border-base-300/60 bg-base-100 px-3 text-sm outline-none focus:border-primary"
                                    required
                                >
                                    {!displayCandidates.includes(profileForm.data.display_name) && (
                                        <option value={profileForm.data.display_name}>
                                            {profileForm.data.display_name || 'Select a display name…'}
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
                                    value={profileForm.data.display_name}
                                    onChange={(e) =>
                                        profileForm.setData('display_name', e.target.value)
                                    }
                                    required
                                />
                            )}
                        </Field>
                        <Field label="Email" error={profileForm.errors.email} required>
                            <TextInput
                                type="email"
                                name="email"
                                value={profileForm.data.email}
                                onChange={(e) => profileForm.setData('email', e.target.value)}
                                autoComplete="email"
                                required
                            />
                        </Field>
                    </div>

                    <div className="mt-6">
                        <h2 className="font-display text-sm font-semibold text-base-content">
                            Profile photo
                        </h2>
                        <p className="mb-3 text-[11px] text-base-content/55">
                            Optional. Falls back to the initials avatar when blank.
                        </p>
                        <FeaturedImagePicker
                            value={profileForm.data.profile_photo}
                            onChange={(value) => profileForm.setData('profile_photo', value)}
                            context="user-profile-photo"
                            placeholderLabel="+ Set profile photo"
                            modalTitle="Choose a profile photo"
                        />
                        {/* Server returns errors keyed by `profile_photo_id` because we
                            rename the field in `transform()`; bracket-cast since
                            useForm's error type only knows the pre-transform keys. */}
                        {(profileForm.errors as Record<string, string | undefined>).profile_photo_id && (
                            <p className="mt-2 text-[11px] text-error">
                                {(profileForm.errors as Record<string, string | undefined>).profile_photo_id}
                            </p>
                        )}
                    </div>

                    {mustVerifyEmail && !auth.user.email_verified_at && (
                        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                            Your email address is unverified.{' '}
                            <Link
                                href={sendVerification().url}
                                method="post"
                                as="button"
                                className="underline hover:no-underline"
                            >
                                Re-send verification email.
                            </Link>
                            {status === 'verification-link-sent' && (
                                <div className="mt-1 text-success">
                                    A new verification link has been sent.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-5 flex items-center justify-end border-t border-base-300/60 pt-4">
                        <PrimaryButton type="submit" loading={profileForm.processing}>
                            Save changes
                        </PrimaryButton>
                    </div>
                </Card>
            </form>

            <Card className="border-error/30">
                <h2 className="font-display text-base font-semibold text-error">Delete account</h2>
                <p className="mt-1 text-sm text-base-content/65">
                    Once your account is deleted, all of its resources and data will be
                    permanently deleted.
                </p>

                {!deleteOpen ? (
                    <div className="mt-4 flex justify-end">
                        <DangerButton type="button" onClick={() => setDeleteOpen(true)}>
                            Delete account
                        </DangerButton>
                    </div>
                ) : (
                    <form onSubmit={submitDelete} className="mt-4 space-y-4">
                        <Field label="Confirm with your password" error={deleteForm.errors.password} required>
                            <TextInput
                                name="password"
                                type="password"
                                value={deleteForm.data.password}
                                onChange={(e) => deleteForm.setData('password', e.target.value)}
                                autoFocus
                                required
                            />
                        </Field>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeleteOpen(false);
                                    deleteForm.reset('password');
                                    deleteForm.clearErrors();
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-base-300/60 bg-base-100 px-4 py-2 text-xs font-semibold text-base-content/80 hover:bg-base-200"
                            >
                                Cancel
                            </button>
                            <DangerButton type="submit">Permanently delete</DangerButton>
                        </div>
                    </form>
                )}
            </Card>
        </>
    );
}

Profile.layout = (page: ReactNode) => <SettingsLayout>{page}</SettingsLayout>;
