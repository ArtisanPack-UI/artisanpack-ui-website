import type { ReactNode } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';

interface VerifyEmailProps {
    status?: string;
}

export default function VerifyEmail({ status }: VerifyEmailProps) {
    const { post, processing } = useForm({});

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post('/email/verification-notification');
    }

    return (
        <>
            <Head title="Verify email" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body text-center">
                    <h1 className="card-title justify-center">Verify your email</h1>
                    <p className="text-sm text-base-content/70">
                        Thanks for signing up! Please verify your email address by clicking the link
                        we just emailed you. If you didn&apos;t receive it, we can send another.
                    </p>

                    {status === 'verification-link-sent' && (
                        <div className="alert alert-success text-sm mt-2">
                            A new verification link has been sent to your email address.
                        </div>
                    )}

                    <form onSubmit={submit} className="flex flex-col gap-4 mt-4">
                        <Button type="submit" color="primary" loading={processing}>
                            Resend verification email
                        </Button>

                        <Link
                            href="/logout"
                            method="post"
                            as="button"
                            className="link link-hover text-sm text-base-content/70"
                        >
                            Log out
                        </Link>
                    </form>
                </div>
            </div>
        </>
    );
}

VerifyEmail.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
