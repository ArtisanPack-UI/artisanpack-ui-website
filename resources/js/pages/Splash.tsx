import { Head, useForm, usePage } from '@inertiajs/react';
import { subscribe } from '@/routes/newsletter';

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
    icon: string;
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

const socialLinks: SocialLink[] = [
    {
        label: 'GitHub',
        href: 'https://github.com/ArtisanPack-UI',
        icon: 'fa-brands fa-github',
    },
    {
        label: 'GitLab',
        href: 'https://gitlab.com/jacob-martella-web-design/artisanpack-ui',
        icon: 'fa-brands fa-gitlab',
    },
    {
        label: 'Bluesky',
        href: 'https://bsky.app/profile/artisanpackui.dev',
        icon: 'fa-brands fa-bluesky',
    },
    {
        label: 'Mastodon',
        href: 'https://mastodon.social/@artisanpackui',
        icon: 'fa-brands fa-mastodon',
    },
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
                className="relative min-h-screen overflow-hidden bg-brand-bg bg-cover bg-fixed bg-center bg-no-repeat font-sans text-brand-text"
                style={{ backgroundImage: 'url(/images/background.png)' }}
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed inset-0 z-0 bg-brand-bg/20"
                />

                <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8 lg:px-8">
                    <a href="/" className="inline-flex items-center" aria-label="ArtisanPack UI home">
                        <img
                            src="/images/wordmark.png"
                            alt="ArtisanPack UI"
                            className="h-9 w-auto"
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
                            <i className="fa-brands fa-github text-lg" aria-hidden="true" />
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

                        <div className="relative mx-auto mt-10 max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-brand-section/40 p-6 text-left shadow-2xl shadow-brand-bg/40 ring-1 ring-inset ring-white/10 backdrop-blur-2xl backdrop-saturate-150 sm:p-8">
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

                    <section className="border-t border-white/5 bg-brand-section/60 backdrop-blur-sm">
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
                                    className="text-lg transition hover:text-brand-secondary"
                                >
                                    <i className={link.icon} aria-hidden="true" />
                                </a>
                            ))}
                        </nav>
                    </div>
                </footer>
            </div>
        </>
    );
}
