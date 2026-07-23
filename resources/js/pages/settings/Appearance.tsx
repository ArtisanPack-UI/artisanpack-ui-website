import { useState, type ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import SettingsLayout from '@/layouts/SettingsLayout';
import { Card, PageHeader } from '@/components/admin/keystone';

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

const MODES: Mode[] = ['light', 'dark', 'system'];

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

            <PageHeader
                title="Appearance"
                description="Choose how the app looks to you. Saved on this device only."
            />

            <Card>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {MODES.map((m) => {
                        const active = mode === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => pick(m)}
                                className={`rounded-lg border px-4 py-6 text-sm font-semibold capitalize transition-colors ${
                                    active
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-base-300/60 bg-base-100 text-base-content/80 hover:bg-base-200'
                                }`}
                            >
                                {m}
                            </button>
                        );
                    })}
                </div>
            </Card>
        </>
    );
}

Appearance.layout = (page: ReactNode) => <SettingsLayout>{page}</SettingsLayout>;
