<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

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

        event(new Registered($user));

        Auth::login($user);

        return to_route('admin.dashboard');
    }
}
