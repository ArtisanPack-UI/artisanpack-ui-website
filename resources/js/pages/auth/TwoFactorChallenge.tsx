import type { ReactNode } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Button, Input } from '@artisanpack-ui/react/form';
import AuthLayout from '@/layouts/AuthLayout';
import TwoFactorChallengeController from '@/actions/App/Http/Controllers/Auth/TwoFactorChallengeController';

interface TwoFactorChallengeProps {
    status?: string;
}

export default function TwoFactorChallenge({ status }: TwoFactorChallengeProps) {
    const form = useForm({ code: '' });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(TwoFactorChallengeController.store().url, {
            onFinish: () => form.reset('code'),
        });
    }

    return (
        <>
            <Head title="Two-factor challenge" />
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title justify-center">Two-factor authentication</h1>
                    <p className="text-center text-sm text-base-content/70">
                        Enter the verification code we just emailed you to continue.
                    </p>
                    {status && <div className="alert alert-info text-sm">{status}</div>}

                    <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
                        <Input
                            name="code"
                            label="Verification code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={form.data.code}
                            error={form.errors.code}
                            onChange={(e) => form.setData('code', e.target.value)}
                            autoFocus
                            required
                        />

                        <div className="mt-2 flex items-center justify-end">
                            <Button type="submit" color="primary" loading={form.processing}>
                                Verify
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

TwoFactorChallenge.layout = (page: ReactNode) => <AuthLayout>{page}</AuthLayout>;
