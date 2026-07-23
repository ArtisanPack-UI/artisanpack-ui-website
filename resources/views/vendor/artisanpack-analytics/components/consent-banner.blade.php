{{--
    Consent Banner Component

    A GDPR-compliant cookie consent banner with customizable categories.

    @props
    - position: 'bottom' | 'top' (default: 'bottom')

    @since 1.0.0
--}}

@props([
    'position' => 'bottom',
])

@php
    $categories = config( 'artisanpack.analytics.privacy.consent_categories', [] );
    $consentRequired = config( 'artisanpack.analytics.privacy.consent_required', false );
@endphp

@if ( $consentRequired )
<div
    x-data="{
        show: false,
        showDetails: false,
        categories: @js( collect( $categories )->mapWithKeys( fn( $cat, $key ) => [ $key => $cat['required'] ?? false ] )->all() ),
        consentRequired: @js( $consentRequired ),
        storageKey: 'ap_analytics_consent',
        visitorId: null,
        apiEndpoint: @js( config( 'artisanpack.analytics.route_prefix', 'api/analytics' ) ),

        init() {
            if ( ! this.consentRequired ) {
                return;
            }

            // Get or generate visitor ID
            this.visitorId = localStorage.getItem( 'ap_visitor_id' );

            // Check if consent already given
            const storedConsent = localStorage.getItem( this.storageKey );

            if ( ! storedConsent ) {
                this.show = true;
                this.$nextTick( () => {
                    // Focus management for accessibility
                    this.$refs.bannerContainer?.focus();
                } );
            } else {
                try {
                    this.categories = JSON.parse( storedConsent );
                } catch ( e ) {
                    this.show = true;
                }
            }
        },

        acceptAll() {
            Object.keys( this.categories ).forEach( key => {
                this.categories[ key ] = true;
            } );
            this.save();
        },

        rejectAll() {
            const requiredCategories = @js( collect( $categories )->filter( fn( $cat ) => $cat['required'] ?? false )->keys()->all() );

            Object.keys( this.categories ).forEach( key => {
                this.categories[ key ] = requiredCategories.includes( key );
            } );
            this.save();
        },

        savePreferences() {
            this.save();
        },

        async save() {
            // Store locally
            localStorage.setItem( this.storageKey, JSON.stringify( this.categories ) );

            // Also set a cookie so the server can read consent status
            const consentValue = JSON.stringify( this.categories );
            const expiryDays = 365;
            const date = new Date();
            date.setTime( date.getTime() + ( expiryDays * 24 * 60 * 60 * 1000 ) );
            document.cookie = `ap_consent=${encodeURIComponent( consentValue )}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;

            // Notify the JavaScript tracker if available
            if ( window.ArtisanPackAnalytics ) {
                Object.entries( this.categories ).forEach( ( [ cat, granted ] ) => {
                    if ( granted ) {
                        window.ArtisanPackAnalytics.consent?.grant?.( [ cat ] );
                    } else {
                        window.ArtisanPackAnalytics.consent?.revoke?.( [ cat ] );
                    }
                } );
            }

            // Send to server if we have a visitor ID
            if ( this.visitorId ) {
                try {
                    await fetch( `/${this.apiEndpoint}/consent/update`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector( 'meta[name=&quot;csrf-token&quot;]' )?.content || '',
                        },
                        body: JSON.stringify( {
                            visitor_id: this.visitorId,
                            categories: this.categories,
                        } ),
                    } );
                } catch ( e ) {
                    console.warn( 'Failed to save consent to server:', e );
                }
            }

            // Announce to screen readers
            this.announceChange();

            this.show = false;
        },

        announceChange() {
            const announcement = document.createElement( 'div' );
            announcement.setAttribute( 'role', 'status' );
            announcement.setAttribute( 'aria-live', 'polite' );
            announcement.setAttribute( 'aria-atomic', 'true' );
            announcement.className = 'sr-only';
            announcement.textContent = '{{ __( "Your privacy preferences have been saved." ) }}';
            document.body.appendChild( announcement );
            setTimeout( () => announcement.remove(), 1000 );
        },

        openPreferences() {
            this.show = true;
            this.$nextTick( () => {
                this.$refs.bannerContainer?.focus();
            } );
        }
    }"
    x-show="show"
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="opacity-0 translate-y-4"
    x-transition:enter-end="opacity-100 translate-y-0"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="opacity-100 translate-y-0"
    x-transition:leave-end="opacity-0 translate-y-4"
    x-cloak
    class="fixed {{ $position === 'bottom' ? 'bottom-0' : 'top-0' }} inset-x-0 z-50 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="consent-banner-title"
    x-ref="bannerContainer"
    tabindex="-1"
>
    <div class="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
        <div class="p-6">
            {{-- Header --}}
            <div class="flex items-start justify-between mb-4">
                <div>
                    <h3
                        id="consent-banner-title"
                        class="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                        {{ __( 'Privacy Settings' ) }}
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {{ __( 'We use cookies to understand how you use our website and improve your experience.' ) }}
                    </p>
                </div>
                <x-artisanpack-button
                    @click="showDetails = !showDetails"
                    class="btn-link btn-sm"
                    x-bind:aria-expanded="showDetails"
                    aria-controls="consent-details"
                >
                    <span x-text="showDetails ? '{{ __( 'Hide Details' ) }}' : '{{ __( 'Show Details' ) }}'"></span>
                </x-artisanpack-button>
            </div>

            {{-- Category Details --}}
            <div
                x-show="showDetails"
                x-collapse
                id="consent-details"
                class="space-y-3 mb-6"
            >
                @foreach ( $categories as $key => $category )
                    <label class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                        <input
                            type="checkbox"
                            x-model="categories['{{ $key }}']"
                            @if ( $category['required'] ?? false )
                                checked
                                disabled
                                aria-disabled="true"
                            @endif
                            class="mt-1 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            id="consent-{{ $key }}"
                        >
                        <div class="flex-1">
                            <span class="font-medium text-gray-900 dark:text-white">
                                {{ __( $category['name'] ?? $key ) }}
                                @if ( $category['required'] ?? false )
                                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                        ({{ __( 'Required' ) }})
                                    </span>
                                @endif
                            </span>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                {{ __( $category['description'] ?? '' ) }}
                            </p>
                        </div>
                    </label>
                @endforeach
            </div>

            {{-- Actions --}}
            <div class="flex flex-wrap items-center justify-end gap-3">
                <x-artisanpack-button
                    @click="rejectAll"
                    class="btn-ghost btn-sm"
                    :label="__( 'Reject All' )"
                />
                <x-artisanpack-button
                    x-show="showDetails"
                    @click="savePreferences"
                    class="btn-neutral btn-sm"
                    :label="__( 'Save Preferences' )"
                />
                <x-artisanpack-button
                    @click="acceptAll"
                    class="btn-primary btn-sm"
                    :label="__( 'Accept All' )"
                />
            </div>
        </div>
    </div>
</div>

{{-- Utility class for screen readers --}}
<style>
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
</style>
@endif
