import type { FormEvent, ReactNode } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Button, Input } from '@artisanpack-ui/react/form';
import SettingsLayout from '@/layouts/SettingsLayout';

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
        form.put('/settings/password', {
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

            <div>
                <h1 className="text-2xl font-semibold">Update password</h1>
                <p className="text-base-content/70 text-sm">
                    Use a long, random password to keep your account secure.
                </p>
            </div>

            {flash.success && <div className="alert alert-success text-sm">{flash.success}</div>}

            <form onSubmit={submit} className="card bg-base-100 shadow">
                <div className="card-body space-y-4">
                    <Input
                        name="current_password"
                        label="Current password"
                        type="password"
                        value={form.data.current_password}
                        error={form.errors.current_password}
                        onChange={(e) => form.setData('current_password', e.target.value)}
                        autoComplete="current-password"
                        required
                    />
                    <Input
                        name="password"
                        label="New password"
                        type="password"
                        value={form.data.password}
                        error={form.errors.password}
                        onChange={(e) => form.setData('password', e.target.value)}
                        autoComplete="new-password"
                        required
                    />
                    <Input
                        name="password_confirmation"
                        label="Confirm password"
                        type="password"
                        value={form.data.password_confirmation}
                        error={form.errors.password_confirmation}
                        onChange={(e) => form.setData('password_confirmation', e.target.value)}
                        autoComplete="new-password"
                        required
                    />

                    <div className="card-actions justify-end">
                        <Button type="submit" color="primary" loading={form.processing}>
                            Save
                        </Button>
                    </div>
                </div>
            </form>
        </>
    );
}

Password.layout = (page: ReactNode) => <SettingsLayout>{page}</SettingsLayout>;
