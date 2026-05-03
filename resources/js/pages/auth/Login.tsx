import type { ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button, Checkbox, Input } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';
import { register } from '@/routes';
import { request as passwordRequest } from '@/routes/password';
import AuthenticatedSessionController from '@/actions/App/Http/Controllers/Auth/AuthenticatedSessionController';

interface LoginProps {
    canResetPassword: boolean;
    status?: string;
}

export default function Login({ canResetPassword, status }: LoginProps) {
    const form = useForm({ email: '', password: '', remember: false });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(AuthenticatedSessionController.store().url, {
            onFinish: () => form.reset('password'),
        });
    }

    return (
        <>
            <Head title="Log in" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title justify-center">Log in to your account</h1>
                    {status && <div className="alert alert-info text-sm">{status}</div>}

                    <form onSubmit={submit} className="flex flex-col gap-4 mt-4">
                        <Input
                            name="email"
                            label="Email address"
                            type="email"
                            value={form.data.email}
                            error={form.errors.email}
                            onChange={(e) => form.setData('email', e.target.value)}
                            autoComplete="email"
                            autoFocus
                            required
                        />
                        <Input
                            name="password"
                            label="Password"
                            type="password"
                            value={form.data.password}
                            error={form.errors.password}
                            onChange={(e) => form.setData('password', e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                        <Checkbox
                            name="remember"
                            label="Remember me"
                            checked={form.data.remember}
                            onChange={(e) => form.setData('remember', e.target.checked)}
                        />

                        <div className="flex items-center justify-between mt-2">
                            {canResetPassword && (
                                <Link
                                    href={passwordRequest().url}
                                    className="link link-primary text-sm"
                                >
                                    Forgot your password?
                                </Link>
                            )}
                            <Button type="submit" color="primary" loading={form.processing}>
                                Log in
                            </Button>
                        </div>
                    </form>

                    <div className="text-center text-sm mt-4 text-base-content/70">
                        Don&apos;t have an account?{' '}
                        <Link href={register().url} className="link link-primary">
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

Login.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
