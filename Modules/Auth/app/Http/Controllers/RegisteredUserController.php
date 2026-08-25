<?php

declare(strict_types=1);

namespace Modules\Auth\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Modules\Auth\Http\Requests\RegisterRequest;
use Modules\Users\Models\User;

class RegisteredUserController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('auth/Register');
    }

    public function store(RegisterRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $firstName = trim((string) $validated['first_name']);
        $lastName  = trim((string) ($validated['last_name'] ?? ''));
        $display   = '' !== $lastName ? $firstName.' '.$lastName : $firstName;

        $user = User::create([
            'first_name'   => $firstName,
            'last_name'    => '' !== $lastName ? $lastName : null,
            'username'     => Str::lower((string) $validated['username']),
            'display_name' => $display,
            'email'        => (string) $validated['email'],
            'password'     => Hash::make((string) $validated['password']),
        ]);

        doAction('keystone.auth.registered', $user);

        event(new Registered($user));

        Auth::login($user);

        return to_route('admin.dashboard');
    }
}
