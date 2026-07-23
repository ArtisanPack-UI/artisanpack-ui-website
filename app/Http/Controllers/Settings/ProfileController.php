<?php

declare(strict_types=1);

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use ArtisanPackUI\MediaLibrary\Models\Media;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $user?->loadMissing('profilePhoto');

        return Inertia::render('settings/Profile', [
            'profile' => $user ? [
                'first_name'    => $user->first_name,
                'last_name'     => $user->last_name,
                'username'      => $user->username,
                'nickname'      => $user->nickname,
                'display_name'  => $user->display_name,
                'email'         => $user->email,
                'profile_photo' => $this->profilePhotoPayload($user),
            ] : null,
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status'          => session('status'),
        ]);
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user      = $request->user();
        $validated = $request->validated();

        $user->fill([
            'first_name'       => $this->optionalString($validated['first_name'] ?? null),
            'last_name'        => $this->optionalString($validated['last_name'] ?? null),
            'username'         => Str::lower((string) $validated['username']),
            'nickname'         => $this->optionalString($validated['nickname'] ?? null),
            'display_name'     => (string) $validated['display_name'],
            'email'            => (string) $validated['email'],
            'profile_photo_id' => $validated['profile_photo_id'] ?? null,
        ]);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return back()->with('success', 'Profile updated.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }

    /**
     * Mirrors {@see \App\Http\Controllers\Admin\UserController::profilePhotoPayload()}
     * so the self-service Profile page can hydrate the same picker the admin
     * Edit screen uses.
     *
     * @return array{id: int, url: string, title: string|null, alt_text: string|null, mime_type: string}|null
     */
    private function profilePhotoPayload(User $user): ?array
    {
        $media = $user->profilePhoto;

        if (! $media instanceof Media) {
            return null;
        }

        return [
            'id'        => (int) $media->id,
            'url'       => (string) $media->url(),
            'title'     => $media->title,
            'alt_text'  => $media->alt_text,
            'mime_type' => (string) $media->mime_type,
        ];
    }

    /**
     * @see \App\Http\Controllers\Admin\UserController::optionalString()
     */
    private function optionalString(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return '' !== $trimmed ? $trimmed : null;
    }
}
