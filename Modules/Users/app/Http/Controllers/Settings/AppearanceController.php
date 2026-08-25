<?php

declare(strict_types=1);

namespace Modules\Users\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class AppearanceController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/Appearance');
    }
}
