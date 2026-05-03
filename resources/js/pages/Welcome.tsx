import { Head } from '@inertiajs/react';

interface WelcomeProps {
    laravelVersion: string;
    phpVersion: string;
}

export default function Welcome({ laravelVersion, phpVersion }: WelcomeProps) {
    return (
        <>
            <Head title="Welcome" />
            <main className="min-h-screen bg-base-200 flex items-center justify-center p-6">
                <div className="card bg-base-100 shadow-xl max-w-2xl w-full">
                    <div className="card-body text-center">
                        <h1 className="card-title text-3xl justify-center text-primary">
                            ArtisanPack UI React Starter Kit
                        </h1>
                        <p className="text-base-content/70">
                            Laravel + Inertia.js + React, ready to build on.
                        </p>

                        <div className="divider" />

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-base-content/60">Laravel</div>
                                <div className="font-mono">{laravelVersion}</div>
                            </div>
                            <div>
                                <div className="text-base-content/60">PHP</div>
                                <div className="font-mono">{phpVersion}</div>
                            </div>
                        </div>

                        <div className="card-actions justify-center mt-6">
                            <a
                                href="https://github.com/ArtisanPack-UI/react-starter-kit"
                                className="btn btn-primary"
                            >
                                Documentation
                            </a>
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
