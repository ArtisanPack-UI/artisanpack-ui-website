<?php

namespace App\Http\Controllers;

use App\Http\Requests\SubscribeRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class NewsletterController extends Controller
{
    public function subscribe(SubscribeRequest $request): RedirectResponse
    {
        $apiKey = (string) config('services.kit.api_key');
        $formId = (string) config('services.kit.form_id');
        $baseUrl = rtrim((string) config('services.kit.base_url'), '/');

        if ($apiKey === '' || $formId === '') {
            Log::error('Kit credentials missing — cannot subscribe.', [
                'has_api_key' => $apiKey !== '',
                'has_form_id' => $formId !== '',
            ]);

            throw ValidationException::withMessages([
                'email' => 'Newsletter is temporarily unavailable. Please try again later.',
            ]);
        }

        $response = Http::acceptJson()
            ->withHeaders(['X-Kit-Api-Key' => $apiKey])
            ->post("{$baseUrl}/forms/{$formId}/subscribers", [
                'email_address' => $request->validated('email'),
                'first_name' => $request->validated('first_name'),
            ]);

        if ($response->failed()) {
            Log::error('Kit subscribe request failed.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw ValidationException::withMessages([
                'email' => 'We could not subscribe you right now. Please try again in a moment.',
            ]);
        }

        return back()->with('success', "You're on the list. Check your inbox to confirm your subscription.");
    }
}
