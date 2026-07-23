import { type ReactNode } from 'react';
import { Head } from '@inertiajs/react';
import KeystoneAdminLayout from '@/layouts/KeystoneAdminLayout';
import { PageHeader } from '@/components/admin/keystone';
import { MediaLibrary } from '@/vendor/media-library';

/**
 * Admin Media page. Renders the artisanpack-ui/media-library
 * `<MediaLibrary />` component (grid, upload, edit, delete, search,
 * folders, tags, type filter). The component talks to the package's
 * `/api/media/*` Sanctum-stateful routes directly; Keystone's role check
 * gates the shell, and Sanctum's stateful API middleware (configured in
 * `bootstrap/app.php`) lets the admin session cookie authorize the
 * underlying JSON requests.
 */
export default function Media() {
    return (
        <>
            <Head title="Media" />
            <div className="flex flex-col gap-7">
                <PageHeader
                    title="Media"
                    description="Images, video, audio, and documents used across your site."
                />
                <MediaLibrary />
            </div>
        </>
    );
}

Media.layout = (page: ReactNode) => <KeystoneAdminLayout>{page}</KeystoneAdminLayout>;
