import type { ReactNode } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button, Input } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';

interface ResetPasswordProps {
    token: string;
    email: string;
}

export default function ResetPassword({ token, email }: ResetPasswordProps) {
    const form = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/reset-password', {
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    }

    return (
        <>
            <Head title="Reset password" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title justify-center">Reset your password</h1>

                    <form onSubmit={submit} className="flex flex-col gap-4 mt-4">
                        <Input
                            name="email"
                            label="Email address"
                            type="email"
                            value={form.data.email}
                            error={form.errors.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            autoComplete="email"
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
                            autoFocus
                            required
                        />
                        <Input
                            name="password_confirmation"
                            label="Confirm new password"
                            type="password"
                            value={form.data.password_confirmation}
                            error={form.errors.password_confirmation}
                            onChange={(e) => form.setData('password_confirmation', e.target.value)}
                            autoComplete="new-password"
                            required
                        />

                        <div className="flex items-center justify-end mt-2">
                            <Button type="submit" color="primary" loading={form.processing}>
                                Reset password
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

ResetPassword.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
