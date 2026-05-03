import type { ReactNode } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/AppLayout';

interface AuthUser {
    name: string;
    email: string;
}

interface SharedProps {
    auth: { user: AuthUser | null };
    [key: string]: unknown;
}

export default function Dashboard() {
    const { auth } = usePage<SharedProps>().props;

    return (
        <>
            <Head title="Dashboard" />
            <div className="p-6 space-y-6 max-w-6xl mx-auto">
                <div>
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-base-content/70 text-sm">
                        Welcome back{auth.user ? `, ${auth.user.name}` : ''}.
                    </p>
                </div>

                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="card bg-base-100 shadow aspect-video">
                            <div className="card-body items-center justify-center text-base-content/40 text-sm">
                                Placeholder
                            </div>
                        </div>
                    ))}
                </div>

                <div className="card bg-base-100 shadow min-h-64">
                    <div className="card-body items-center justify-center text-base-content/40">
                        Main panel placeholder
                    </div>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
