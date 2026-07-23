{{--
    Analytics Tracker Script Component

    Usage:
    <x-analytics::tracker-script />

    With custom config:
    <x-analytics::tracker-script :debug="true" />

    @since 1.0.0
--}}

@props([
    'async' => true,
    'defer' => false,
    'minified' => true,
    'debug' => false,
])

@php
    $scriptPath = $minified
        ? route( 'analytics.tracker.script.min' )
        : route( 'analytics.tracker.script' );

    $attributes = [];

    if ( $async ) {
        $attributes[] = 'async';
    }

    if ( $defer ) {
        $attributes[] = 'defer';
    }
@endphp

@if ( config( 'artisanpack.analytics.enabled', true ) )
    @if ( $debug )
        <script>
            window.__ARTISANPACK_ANALYTICS_DEBUG__ = true;
        </script>
    @endif
    <script src="{{ $scriptPath }}" {{ implode( ' ', $attributes ) }}></script>
@endif
