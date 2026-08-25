import type { FormEvent, ReactNode } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { Card, PageHeader } from '@/components/admin/keystone';
import { Field, PrimaryButton, TextInput } from '@/components/admin/keystone-form';
import { update as updatePassword } from '@/routes/admin/password';

interface SharedProps {
    flash: { success?: string };
    [key: string]: unknown;
}

export default function Password() {
    const { flash } = usePage<SharedProps>().props;

    const form = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    function submit(e: FormEvent) {
        e.preventDefault();
        form.put(updatePassword().url, {
            preserveScroll: true,
            onSuccess: () => form.reset(),
            onError: () => {
                if (form.errors.password) form.reset('password', 'password_confirmation');
                if (form.errors.current_password) form.reset('current_password');
            },
        });
    }

    return (
        <>
            <Head title="Password" />

            <PageHeader
                title="Update password"
                description="Use a long, random password to keep your account secure."
            />

            {flash.success && (
                <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
                    {flash.success}
                </div>
            )}

            <form onSubmit={submit}>
                <Card>
                    <div className="flex flex-col gap-5">
                        <Field label="Current password" error={form.errors.current_password} required>
                            <TextInput
                                type="password"
                                name="current_password"
                                value={form.data.current_password}
                                onChange={(e) => form.setData('current_password', e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </Field>
                        <Field label="New password" error={form.errors.password} required>
                            <TextInput
                                type="password"
                                name="password"
                                value={form.data.password}
                                onChange={(e) => form.setData('password', e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </Field>
                        <Field
                            label="Confirm password"
                            error={form.errors.password_confirmation}
                            required
                        >
                            <TextInput
                                type="password"
                                name="password_confirmation"
                                value={form.data.password_confirmation}
                                onChange={(e) => form.setData('password_confirmation', e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </Field>
                    </div>

                    <div className="mt-5 flex items-center justify-end border-t border-base-300/60 pt-4">
                        <PrimaryButton type="submit" loading={form.processing}>
                            Save changes
                        </PrimaryButton>
                    </div>
                </Card>
            </form>
        </>
    );
}

Password.layout = (page: ReactNode) => <SettingsLayout>{page}</SettingsLayout>;
