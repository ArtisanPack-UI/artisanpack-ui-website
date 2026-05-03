import type { ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button, Input } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';

interface ForgotPasswordProps {
    status?: string;
}

export default function ForgotPassword({ status }: ForgotPasswordProps) {
    const form = useForm({ email: '' });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/forgot-password');
    }

    return (
        <>
            <Head title="Forgot password" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title justify-center">Forgot your password?</h1>
                    <p className="text-sm text-base-content/70 text-center">
                        Enter your email and we&apos;ll send you a link to reset it.
                    </p>

                    {status && <div className="alert alert-success text-sm mt-2">{status}</div>}

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

                        <div className="flex items-center justify-between mt-2">
                            <Link href="/login" className="link link-primary text-sm">
                                Back to login
                            </Link>
                            <Button type="submit" color="primary" loading={form.processing}>
                                Email password reset link
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

ForgotPassword.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
