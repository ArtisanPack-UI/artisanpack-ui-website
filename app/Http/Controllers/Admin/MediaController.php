<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin shell route for the Media library. The page itself renders the
 * artisanpack-ui/media-library package's `<MediaLibrary />` React component,
 * which talks to the package's `/api/media/*` Sanctum-protected JSON routes
 * directly. Keystone only needs to gate access via `role:` middleware and
 * surface the Inertia mount point.
 */
class MediaController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/Media');
    }
}
