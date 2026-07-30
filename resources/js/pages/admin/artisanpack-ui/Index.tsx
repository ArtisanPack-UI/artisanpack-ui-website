import type { ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';

export default function ArtisanPackUIIndex() {
    return (
        <>
            <Head title="ArtisanPack UI" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="ArtisanPack UI"
                    description="Landing screen for the ArtisanPack UI site plugin. Site-specific tools and dashboards will live here."
                    breadcrumbs={['ArtisanPack UI']}
                />
            </div>
        </>
    );
}

ArtisanPackUIIndex.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
