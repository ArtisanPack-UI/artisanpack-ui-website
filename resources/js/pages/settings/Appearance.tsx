import { useState, type ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import SettingsLayout from '@/layouts/SettingsLayout';

type Mode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function readSavedMode(): Mode {
    if (typeof window === 'undefined') return 'system';
    return (window.localStorage.getItem(STORAGE_KEY) as Mode | null) ?? 'system';
}

function applyTheme(mode: Mode) {
    if (typeof window === 'undefined') return;
    const resolved =
        mode === 'system'
            ? window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light'
            : mode;
    window.document.documentElement.setAttribute('data-theme', resolved);
}

export default function Appearance() {
    const [mode, setMode] = useState<Mode>(() => {
        const saved = readSavedMode();
        applyTheme(saved);
        return saved;
    });

    function pick(next: Mode) {
        setMode(next);
        window.localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
    }

    return (
        <>
            <Head title="Appearance" />

            <div>
                <h1 className="text-2xl font-semibold">Appearance</h1>
                <p className="text-base-content/70 text-sm">
                    Choose how the app looks to you. Saved on this device only.
                </p>
            </div>

            <div className="card bg-base-100 shadow">
                <div className="card-body">
                    <div className="join">
                        {(['light', 'dark', 'system'] as Mode[]).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => pick(m)}
                                className={`btn join-item capitalize ${mode === m ? 'btn-primary' : ''}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

Appearance.layout = (page: ReactNode) => <SettingsLayout>{page}</SettingsLayout>;
