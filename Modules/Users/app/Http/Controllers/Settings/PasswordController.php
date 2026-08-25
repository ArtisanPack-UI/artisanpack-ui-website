<?php

declare(strict_types=1);

namespace Modules\Users\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Users\Http\Requests\Settings\PasswordUpdateRequest;

class PasswordController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('settings/Password');
    }

    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'password' => Hash::make($request->validated('password')),
        ]);

        return back()->with('success', 'Password updated.');
    }
}
