<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('appearance page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/settings/appearance')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('settings/Appearance'));
});

test('guests are redirected from appearance page', function () {
    $this->get('/settings/appearance')->assertRedirect('/login');
});
