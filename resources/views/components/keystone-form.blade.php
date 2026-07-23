@props([
    'formSlug',
    'class' => '',
])

{{--
    Inline form embed for theme Blade templates. Emits a mount point that
    the `keystone-form-island.tsx` bundle hydrates with the forms package's
    React `FormRenderer`. Submissions go to `/api/v1/forms/{slug}/submit`
    via Sanctum-stateful XSRF; the form itself does not require login.

    Usage:
        <x-keystone-form form-slug="contact" />
--}}
<div
    data-keystone-form="{{ $formSlug }}"
    {{ $attributes->merge(['class' => $class]) }}
></div>

@once
    @vite(['resources/js/keystone-form-island.tsx'])
@endonce
