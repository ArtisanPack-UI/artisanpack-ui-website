import { Head, useForm, usePage } from '@inertiajs/react';
import { subscribe } from '@/routes/newsletter';
import type { ReactNode } from 'react';

interface SharedProps {
    flash: {
        success?: string;
    };
    [key: string]: unknown;
}

interface Feature {
    title: string;
    description: string;
}

interface SocialLink {
    label: string;
    href: string;
    icon: ReactNode;
}

const features: Feature[] = [
    {
        title: 'Component libraries',
        description:
            'Accessible React, Vue, and Livewire component libraries that share design tokens and ship WCAG 2.2 AA out of the box.',
    },
    {
        title: 'CMS framework + visual editor',
        description:
            'Flexible backend scaffolding and a block-based editor so you can stand up admin tools, content models, and pages in days.',
    },
    {
        title: 'Batteries included',
        description:
            'Drop-in packages for media library, SEO, privacy-first analytics, drag-and-drop, and a 20+ field form builder.',
    },
    {
        title: '100% open source',
        description:
            'Every package is permissively licensed and Laravel-native. No paywalls, no lock-in, audit and extend anything.',
    },
];

const iconProps = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true,
} as const;

const GithubIcon = () => (
    <svg {...iconProps}>
        <path d="M12 .5C5.73.5.67 5.57.67 11.84c0 5.02 3.24 9.27 7.74 10.77.57.1.78-.25.78-.55v-2.1c-3.15.68-3.81-1.34-3.81-1.34-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.74.4-1.24.72-1.53-2.51-.29-5.16-1.26-5.16-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.16a10.9 10.9 0 0 1 5.74 0c2.19-1.47 3.15-1.16 3.15-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.66 5.31-5.19 5.59.41.35.77 1.05.77 2.12v3.14c0 .3.21.66.79.55 4.5-1.5 7.73-5.75 7.73-10.77C23.33 5.57 18.27.5 12 .5Z" />
    </svg>
);

const GitlabIcon = () => (
    <svg {...iconProps}>
        <path d="M23.94 13.31 22.6 9.18l-2.66-8.17a.46.46 0 0 0-.87 0L16.4 9.18H7.6L4.93 1.01a.46.46 0 0 0-.87 0L1.4 9.18.06 13.31a.92.92 0 0 0 .33 1.03L12 23l11.61-8.66a.92.92 0 0 0 .33-1.03Z" />
    </svg>
);

const BlueskyIcon = () => (
    <svg {...iconProps}>
        <path d="M6.34 3.4c2.96 2.23 6.15 6.74 7.32 9.16 1.17-2.42 4.36-6.93 7.32-9.16C23.12 1.8 26 .55 26 3.82c0 .65-.37 5.47-.59 6.25-.76 2.72-3.54 3.41-6.02 2.99 4.33.74 5.43 3.18 3.05 5.62-4.52 4.64-6.5-1.16-7-2.65l-.09-.26-.09.26c-.5 1.49-2.48 7.29-7 2.65-2.38-2.44-1.28-4.88 3.05-5.62-2.48.42-5.26-.27-6.02-2.99C5.07 9.29 4.7 4.47 4.7 3.82c0-3.27 2.88-2.02 3.66-1.42Z" transform="translate(-2)" />
    </svg>
);

const MastodonIcon = () => (
    <svg {...iconProps}>
        <path d="M23.27 5.32C22.92 2.76 20.66.74 17.99.35 17.54.28 15.83 0 11.87 0h-.03c-3.96 0-4.81.28-5.26.35C3.99.73 1.6 2.54.99 5.14.7 6.42.67 7.85.72 9.16c.08 1.87.1 3.74.27 5.6.12 1.24.34 2.46.65 3.66.59 2.21 2.77 4.05 4.93 4.81 2.31.79 4.8.92 7.18.38.26-.06.52-.13.78-.21.58-.18 1.27-.39 1.77-.75.01-.01.02-.02.02-.03v-1.77a.04.04 0 0 0-.05-.04c-1.51.36-3.06.54-4.61.54-2.66 0-3.37-1.27-3.58-1.79a5.55 5.55 0 0 1-.31-1.41.04.04 0 0 1 .05-.04c1.48.36 3 .54 4.52.54.37 0 .73 0 1.1-.01 1.53-.04 3.14-.12 4.65-.41.04-.01.07-.01.11-.02 2.38-.46 4.64-1.89 4.87-5.52.01-.14.04-1.5.04-1.65.01-.5.16-3.57-.02-5.45Zm-3.71 9.04h-2.32V8.68c0-1.19-.5-1.8-1.51-1.8-1.11 0-1.67.72-1.67 2.14v3.1h-2.31V9.02c0-1.42-.56-2.14-1.67-2.14-1.01 0-1.51.61-1.51 1.8v5.68H6.25V8.51c0-1.19.3-2.14.91-2.83.62-.7 1.44-1.05 2.46-1.05 1.18 0 2.07.45 2.66 1.36l.58.97.58-.97c.59-.91 1.48-1.36 2.66-1.36 1.01 0 1.83.36 2.46 1.05.61.7.91 1.64.91 2.83v5.85Z" />
    </svg>
);

const socialLinks: SocialLink[] = [
    { label: 'GitHub', href: 'https://github.com/ArtisanPack-UI', icon: <GithubIcon /> },
    { label: 'GitLab', href: 'https://gitlab.com/jacob-martella-web-design/artisanpack-ui', icon: <GitlabIcon /> },
    { label: 'Bluesky', href: 'https://bsky.app/profile/artisanpackui.dev', icon: <BlueskyIcon /> },
    { label: 'Mastodon', href: 'https://mastodon.social/@artisanpackui', icon: <MastodonIcon /> },
];

export default function Splash() {
    const { flash } = usePage<SharedProps>().props;

    const form = useForm({
        email: '',
        first_name: '',
    });

    const subscribed = Boolean(flash?.success) && form.wasSuccessful;

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.post(subscribe().url, {
            preserveScroll: true,
            onSuccess: () => form.reset('email', 'first_name'),
        });
    }

    return (
        <>
            <Head title="ArtisanPack UI — open-source packages for Laravel artisans" />

            <div
                className="relative min-h-screen overflow-hidden bg-brand-bg bg-cover bg-center bg-no-repeat font-sans text-brand-text"
                style={{ backgroundImage: 'url(/images/background.webp)' }}
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 bg-brand-bg/20"
                />

                <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8 lg:px-8">
                    <a href="/" className="inline-flex items-center" aria-label="ArtisanPack UI home">
                        <img
                            src="/images/wordmark.webp"
                            alt="ArtisanPack UI"
                            width={336}
                            height={36}
                            className="h-9 w-auto"
                            fetchPriority="high"
                            decoding="async"
                        />
                    </a>
                    <nav aria-label="Primary" className="flex items-center gap-5 text-sm">
                        <a
                            href="https://docs.artisanpackui.dev"
                            className="hidden font-medium text-white/80 transition hover:text-brand-secondary sm:inline"
                        >
                            Docs &rarr;
                        </a>
                        <a
                            href="https://github.com/ArtisanPack-UI"
                            aria-label="ArtisanPack UI on GitHub"
                            className="text-white/80 transition hover:text-brand-secondary"
                        >
                            <GithubIcon />
                        </a>
                    </nav>
                </header>

                <main className="relative z-10">
                    <section className="mx-auto max-w-3xl px-6 pt-12 pb-20 text-center lg:px-8 lg:pt-20 lg:pb-28">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-secondary">
                            <span className="size-2 rounded-full bg-brand-secondary" />
                            Coming soon
                        </span>
                        <h1 className="mt-6 font-sans text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                            The open-source ecosystem for{' '}
                            <span className="bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent bg-clip-text text-transparent">
                                Laravel artisans
                            </span>
                            .
                        </h1>
                        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75 sm:text-xl">
                            ArtisanPack UI is a growing collection of accessibility-first packages
                            &mdash; component libraries, a CMS framework, a visual editor, media,
                            forms, SEO, and analytics &mdash; so Laravel teams can ship polished
                            products without rebuilding the foundation every time.
                        </p>

                        <div className="relative mx-auto mt-10 max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-brand-section/40 p-6 text-left shadow-2xl shadow-brand-bg/40 ring-1 ring-inset ring-white/10 sm:p-8">
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
                            />
                            {subscribed ? (
                                <div role="status" aria-live="polite" className="flex flex-col gap-3">
                                    <h2 className="text-2xl font-bold text-brand-secondary">
                                        You&rsquo;re on the list.
                                    </h2>
                                    <p className="text-white/80">{flash?.success}</p>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-xl font-bold sm:text-2xl">
                                        Get launch updates &mdash; and the cheat sheet.
                                    </h2>
                                    <p className="mt-2 text-sm text-white/70">
                                        Subscribe for monthly tips, tutorials, and updates. Sign up now and
                                        we&rsquo;ll send you the ArtisanPack UI Quick Start Cheat Sheet
                                        &mdash; a 6-page reference for getting up and running fast.
                                    </p>

                                    <form onSubmit={submit} className="mt-6 flex flex-col gap-3" noValidate>
                                        <div className="flex flex-col gap-2">
                                            <label htmlFor="first_name" className="sr-only">
                                                First name
                                            </label>
                                            <input
                                                id="first_name"
                                                name="first_name"
                                                type="text"
                                                autoComplete="given-name"
                                                placeholder="First name (optional)"
                                                value={form.data.first_name}
                                                onChange={(e) => form.setData('first_name', e.target.value)}
                                                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/40"
                                            />
                                            {form.errors.first_name && (
                                                <p className="text-sm text-brand-accent">
                                                    {form.errors.first_name}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label htmlFor="email" className="sr-only">
                                                Email address
                                            </label>
                                            <div className="flex flex-col gap-3 sm:flex-row">
                                                <input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    inputMode="email"
                                                    autoComplete="email"
                                                    required
                                                    placeholder="you@example.com"
                                                    value={form.data.email}
                                                    onChange={(e) => form.setData('email', e.target.value)}
                                                    aria-invalid={form.errors.email ? 'true' : 'false'}
                                                    className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/50 focus:border-brand-secondary focus:outline-none focus:ring-2 focus:ring-brand-secondary/40"
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={form.processing}
                                                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-primary px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:bg-brand-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {form.processing ? 'Subscribing…' : 'Send me the cheat sheet'}
                                                </button>
                                            </div>
                                            {form.errors.email && (
                                                <p className="text-sm text-brand-accent">
                                                    {form.errors.email}
                                                </p>
                                            )}
                                        </div>

                                        <p className="text-xs text-white/50">
                                            We respect your privacy. Unsubscribe at any time.
                                        </p>
                                    </form>
                                </>
                            )}
                        </div>
                    </section>

                    <section className="border-t border-white/5 bg-brand-section/60">
                        <div className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
                            <div className="mx-auto max-w-2xl text-center">
                                <h2 className="text-3xl font-bold sm:text-4xl">
                                    More than a UI kit.
                                </h2>
                                <p className="mt-4 text-lg text-white/70">
                                    A growing toolbox of Laravel-native packages that work great alone and
                                    even better together.
                                </p>
                            </div>

                            <ul className="mt-12 grid gap-6 sm:grid-cols-2">
                                {features.map((feature, index) => (
                                    <li
                                        key={feature.title}
                                        className="rounded-2xl border border-white/10 bg-brand-bg/60 p-6 shadow-lg"
                                    >
                                        <span
                                            className="inline-flex size-10 items-center justify-center rounded-lg text-sm font-bold"
                                            style={{
                                                background:
                                                    index % 3 === 0
                                                        ? 'rgba(41, 98, 255, 0.18)'
                                                        : index % 3 === 1
                                                          ? 'rgba(0, 229, 255, 0.18)'
                                                          : 'rgba(224, 64, 251, 0.18)',
                                                color:
                                                    index % 3 === 0
                                                        ? '#2962FF'
                                                        : index % 3 === 1
                                                          ? '#00E5FF'
                                                          : '#E040FB',
                                            }}
                                            aria-hidden="true"
                                        >
                                            0{index + 1}
                                        </span>
                                        <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                                        <p className="mt-2 text-white/70">{feature.description}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>
                </main>

                <footer className="relative z-10 border-t border-white/5">
                    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 text-sm text-white/60 sm:flex-row lg:px-8">
                        <p>&copy; {new Date().getFullYear()} ArtisanPack UI. All rights reserved.</p>

                        <nav aria-label="Social" className="flex items-center gap-5">
                            <a
                                href="https://docs.artisanpackui.dev"
                                className="transition hover:text-brand-secondary"
                            >
                                Docs
                            </a>
                            {socialLinks.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    aria-label={link.label}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                    className="transition hover:text-brand-secondary"
                                >
                                    {link.icon}
                                </a>
                            ))}
                        </nav>
                    </div>
                </footer>
            </div>
        </>
    );
}
