<?php

use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config()->set('services.kit.api_key', 'test-key');
    config()->set('services.kit.form_id', '12345');
    config()->set('services.kit.base_url', 'https://api.kit.com/v4');
});

test('splash page renders the Splash component', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Splash'));
});

test('a valid email is forwarded to Kit', function () {
    Http::fake([
        'api.kit.com/v4/forms/12345/subscribers' => Http::response(['subscriber' => ['id' => 1]], 200),
    ]);

    $this->from('/')
        ->post('/subscribe', [
            'email' => 'reader@example.com',
            'first_name' => 'Reader',
        ])
        ->assertRedirect('/')
        ->assertSessionHas('success');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.kit.com/v4/forms/12345/subscribers'
            && $request->hasHeader('X-Kit-Api-Key', 'test-key')
            && $request['email_address'] === 'reader@example.com'
            && $request['first_name'] === 'Reader';
    });
});

test('email is required', function () {
    Http::fake();

    $this->from('/')
        ->post('/subscribe', ['email' => ''])
        ->assertSessionHasErrors('email');

    Http::assertNothingSent();
});

test('email must be a valid address', function () {
    Http::fake();

    $this->from('/')
        ->post('/subscribe', ['email' => 'not-an-email'])
        ->assertSessionHasErrors('email');

    Http::assertNothingSent();
});

test('a Kit failure surfaces a friendly validation error', function () {
    Http::fake([
        'api.kit.com/v4/forms/12345/subscribers' => Http::response(['error' => 'boom'], 500),
    ]);

    $this->from('/')
        ->post('/subscribe', ['email' => 'reader@example.com'])
        ->assertRedirect('/')
        ->assertSessionHasErrors('email');
});

test('missing Kit credentials short-circuit the request', function () {
    config()->set('services.kit.api_key', '');
    config()->set('services.kit.form_id', '');

    Http::fake();

    $this->from('/')
        ->post('/subscribe', ['email' => 'reader@example.com'])
        ->assertSessionHasErrors('email');

    Http::assertNothingSent();
});
