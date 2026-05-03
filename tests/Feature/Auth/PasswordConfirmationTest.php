<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('confirm password screen can be rendered', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/confirm-password')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/ConfirmPassword'));
});

test('password can be confirmed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/confirm-password', ['password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('dashboard', absolute: false));
});

test('password is not confirmed with invalid password', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/confirm-password', ['password' => 'wrong-password'])
        ->assertSessionHasErrors('password');
});
