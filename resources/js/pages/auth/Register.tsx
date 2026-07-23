import type { ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button, Input } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';

export default function Register() {
    const form = useForm({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post('/register', {
            onFinish: () => form.reset('password', 'password_confirmation'),
        });
    }

    return (
        <>
            <Head title="Register" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title justify-center">Create an account</h1>

                    <form onSubmit={submit} className="flex flex-col gap-4 mt-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Input
                                name="first_name"
                                label="First name"
                                value={form.data.first_name}
                                error={form.errors.first_name}
                                onChange={(e) => form.setData('first_name', e.target.value)}
                                autoComplete="given-name"
                                autoFocus
                                required
                            />
                            <Input
                                name="last_name"
                                label="Last name"
                                value={form.data.last_name}
                                error={form.errors.last_name}
                                onChange={(e) => form.setData('last_name', e.target.value)}
                                autoComplete="family-name"
                            />
                        </div>
                        <Input
                            name="username"
                            label="Username"
                            value={form.data.username}
                            error={form.errors.username}
                            onChange={(e) => form.setData('username', e.target.value)}
                            autoComplete="username"
                            required
                        />
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
                            label="Password"
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

                        <div className="flex items-center justify-end mt-2">
                            <Button type="submit" color="primary" loading={form.processing}>
                                Create account
                            </Button>
                        </div>
                    </form>

                    <div className="text-center text-sm mt-4 text-base-content/70">
                        Already registered?{' '}
                        <Link href="/login" className="link link-primary">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

Register.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
