import type { ReactNode } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import admin from '@/routes/admin';
import siteDesign from '@/routes/admin/site-design';
import { Card, Icon, PageHeader } from '@/components/admin/keystone';
import type { KeystoneSharedProps, SiteInfo } from '@/types/keystone';

interface ActiveTheme {
    slug: string;
    name: string;
    version: string;
    author: string;
    description: string;
}

interface Tile {
    title: string;
    description: string;
    icon: ReactNode;
    href: string;
    /**
     * True when the destination is a plain-blade SPA mount (the visual
     * editor) rather than an Inertia page — those need a full page load
     * via `<a>` instead of `<Link>`.
     */
    external?: boolean;
    cta: string;
}

interface SiteDesignProps {
    site: SiteInfo;
    active_theme: ActiveTheme | null;
}

export default function SiteDesign({ site, active_theme: activeTheme }: SiteDesignProps) {
    const page = usePage<KeystoneSharedProps & Record<string, unknown>>();
    const isAdmin = (page.props.auth?.roles ?? []).includes('admin');

    // Site-editor SPA sections map to path segments — see the package's
    // `site-editor/sections.tsx`. Deep-linking lands the user on the right
    // surface inside the editor instead of the default templates view.
    const editorRoot = admin.siteEditor().url;
    const editorTemplateParts = admin.siteEditor('template-parts').url;
    const editorPatterns = admin.siteEditor('patterns').url;
    const editorNavigation = admin.siteEditor('navigation').url;

    const tiles: Tile[] = [
        {
            title: 'Theme',
            description: 'Install, switch, and manage themes.',
            icon: Icon.site,
            href: siteDesign.themes.index().url,
            cta: 'Manage themes',
        },
        {
            title: 'Business Info',
            description: 'Hours, contact details, and social links — edit once, render anywhere.',
            icon: Icon.settings,
            href: siteDesign.businessInfo.edit().url,
            cta: 'Edit business info',
        },
        {
            title: 'Layouts',
            description: 'Header, footer, and global page layouts.',
            icon: Icon.pages,
            href: editorTemplateParts,
            external: true,
            cta: 'Edit layouts',
        },
        {
            title: 'Components',
            description: 'Reusable patterns like CTAs and feature grids.',
            icon: Icon.integrations,
            href: editorPatterns,
            external: true,
            cta: 'Edit patterns',
        },
        {
            title: 'Navigation',
            description: 'Primary, footer, and mobile menus.',
            icon: Icon.panelLeft,
            href: editorNavigation,
            external: true,
            cta: 'Edit menus',
        },
    ];

    return (
        <>
            <Head title="Site Design" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Site Design"
                    description="Edit the global look and feel with the visual site editor."
                    actions={
                        isAdmin ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                    href={siteDesign.themes.index().url}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/80 shadow-sm hover:bg-base-200"
                                >
                                    {Icon.site}
                                    Manage themes
                                </Link>
                                {/* Plain `<a>`, not an Inertia `<Link>` — the */}
                                {/* site editor is a plain-blade SPA mount, not */}
                                {/* an Inertia page, so it needs a full page load. */}
                                <a
                                    href={editorRoot}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-content shadow-sm hover:bg-primary-hover"
                                >
                                    {Icon.edit}
                                    Open visual editor
                                </a>
                            </div>
                        ) : undefined
                    }
                />

                <Card>
                    <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">Currently editing</div>
                            <div className="font-display text-xl font-bold text-base-content">{site.name}</div>
                            <div className="text-sm text-base-content/65">{site.url}</div>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                            Production
                        </div>
                    </div>
                </Card>

                <div className="grid grid-cols-12 gap-7">
                    {tiles.map((tile) => {
                        const inner = (
                            <Card className="flex h-full flex-col gap-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.02]">
                                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/8 text-primary">{tile.icon}</span>
                                <div>
                                    <div className="font-display text-base font-semibold text-base-content">{tile.title}</div>
                                    <div className="mt-1 text-sm text-base-content/65">{tile.description}</div>
                                </div>
                                <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary">
                                    {tile.cta}
                                    {Icon.chevronRight}
                                </div>
                            </Card>
                        );

                        const className = 'col-span-12 sm:col-span-6 xl:col-span-3';

                        return tile.external ? (
                            <a key={tile.title} href={tile.href} className={className}>
                                {inner}
                            </a>
                        ) : (
                            <Link key={tile.title} href={tile.href} className={className}>
                                {inner}
                            </Link>
                        );
                    })}
                </div>

                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
                                {Icon.site}
                            </span>
                            <div>
                                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-base-content/55">Active theme</div>
                                {activeTheme ? (
                                    <>
                                        <div className="font-display text-base font-semibold text-base-content">
                                            {activeTheme.name}
                                            {activeTheme.version ? (
                                                <span className="ml-1.5 text-xs font-normal text-base-content/55">v{activeTheme.version}</span>
                                            ) : null}
                                        </div>
                                        {activeTheme.description ? (
                                            <p className="mt-0.5 text-sm text-base-content/65">{activeTheme.description}</p>
                                        ) : null}
                                        {activeTheme.author ? (
                                            <div className="mt-0.5 text-xs text-base-content/55">by {activeTheme.author}</div>
                                        ) : null}
                                    </>
                                ) : (
                                    <div className="text-sm text-base-content/65">No theme is currently active.</div>
                                )}
                            </div>
                        </div>
                        {isAdmin ? (
                            <Link
                                href={siteDesign.themes.index().url}
                                className="inline-flex items-center gap-1.5 self-start rounded-lg border border-base-300 px-3 py-2 text-xs font-semibold text-base-content/80 hover:bg-base-200 sm:self-auto"
                            >
                                {activeTheme ? 'Switch theme' : 'Install a theme'}
                                {Icon.chevronRight}
                            </Link>
                        ) : null}
                    </div>
                </Card>
            </div>
        </>
    );
}

SiteDesign.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
