import type { ReactNode } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button, Input } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';

export default function ConfirmPassword() {
    const form = useForm({ password: '' });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/confirm-password', {
            onFinish: () => form.reset('password'),
        });
    }

    return (
        <>
            <Head title="Confirm password" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title justify-center">Confirm your password</h1>
                    <p className="text-sm text-base-content/70 text-center">
                        This is a secure area. Please confirm your password before continuing.
                    </p>

                    <form onSubmit={submit} className="flex flex-col gap-4 mt-4">
                        <Input
                            name="password"
                            label="Password"
                            type="password"
                            value={form.data.password}
                            error={form.errors.password}
                            onChange={(e) => form.setData('password', e.target.value)}
                            autoComplete="current-password"
                            autoFocus
                            required
                        />

                        <div className="flex items-center justify-end mt-2">
                            <Button type="submit" color="primary" loading={form.processing}>
                                Confirm
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

ConfirmPassword.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
