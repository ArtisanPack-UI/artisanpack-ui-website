<div class="platform-dashboard" aria-label="{{ __( 'Platform Analytics Dashboard' ) }}">
    {{-- Header with controls --}}
    <div class="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h1 class="text-2xl font-bold">{{ __( 'Platform Dashboard' ) }}</h1>
            <p class="mt-1 text-sm text-base-content/70">{{ __( 'Analytics across all sites' ) }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
            {{-- Date Range Selector --}}
            <x-artisanpack-select
                wire:model.live="dateRange"
                :options="collect( $dateRangeOptions )->map( fn( $label, $value ) => [ 'id' => $value, 'name' => $label ] )->values()->all()"
                option-value="id"
                option-label="name"
                class="select-sm"
            />

            {{-- Export Button --}}
            <x-artisanpack-dropdown right>
                <x-slot:trigger>
                    <x-artisanpack-button icon="o-arrow-down-tray" :label="__( 'Export' )" class="btn-sm btn-outline" />
                </x-slot:trigger>
                <x-artisanpack-menu-item
                    wire:click="exportReport('csv')"
                    :title="__( 'Export CSV' )"
                />
                <x-artisanpack-menu-item
                    wire:click="exportReport('json')"
                    :title="__( 'Export JSON' )"
                />
            </x-artisanpack-dropdown>
        </div>
    </div>

    {{-- Platform Stats Cards --}}
    <div class="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
        {{-- Total Sites --}}
        <x-artisanpack-stat
            :title="__( 'Total Sites' )"
            :value="number_format( $this->platformStats['total_sites'] ?? 0 )"
            :description="__( 'Active sites' ) . ': ' . number_format( $this->platformStats['active_sites'] ?? 0 )"
            icon="o-globe-alt"
            color="text-primary"
            class="shadow"
        />

        {{-- Total Visitors --}}
        <x-artisanpack-stat
            :title="__( 'Total Visitors' )"
            :value="number_format( $this->platformStats['total_visitors'] ?? 0 )"
            :description="__( 'Unique visitors' )"
            icon="o-users"
            color="text-secondary"
            class="shadow"
        />

        {{-- Total Sessions --}}
        <x-artisanpack-stat
            :title="__( 'Total Sessions' )"
            :value="number_format( $this->platformStats['total_sessions'] ?? 0 )"
            :description="__( 'All sites combined' )"
            icon="o-arrow-trending-up"
            color="text-accent"
            class="shadow"
        />

        {{-- Total Page Views --}}
        <x-artisanpack-stat
            :title="__( 'Page Views' )"
            :value="number_format( $this->platformStats['total_page_views'] ?? 0 )"
            :description="__( 'All pages viewed' )"
            icon="o-eye"
            color="text-info"
            class="shadow"
        />
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {{-- Top Sites by Traffic --}}
        <x-artisanpack-card :title="__( 'Top Sites by Traffic' )" class="shadow-xl">
            @if ( $this->topSites->isEmpty() )
                <div class="py-8 text-center text-base-content/50">
                    {{ __( 'No site data available for this period.' ) }}
                </div>
            @else
                <div class="overflow-x-auto">
                    <table class="table table-sm" aria-label="{{ __( 'Top sites by traffic' ) }}">
                        <thead>
                            <tr>
                                <th scope="col">{{ __( 'Site' ) }}</th>
                                <th scope="col" class="text-right">{{ __( 'Visitors' ) }}</th>
                                <th scope="col" class="text-right">{{ __( 'Sessions' ) }}</th>
                                <th scope="col" class="text-right">{{ __( 'Page Views' ) }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ( $this->topSites as $site )
                                <tr>
                                    <td>
                                        <div class="flex items-center gap-2">
                                            <div class="w-2 h-2 rounded-full bg-primary"></div>
                                            <div>
                                                <div class="font-medium">{{ $site->name }}</div>
                                                <div class="text-xs opacity-50">{{ $site->domain }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-right">{{ number_format( $site->visitors_count ?? 0 ) }}</td>
                                    <td class="text-right">{{ number_format( $site->sessions_count ?? 0 ) }}</td>
                                    <td class="text-right">{{ number_format( $site->page_views_count ?? 0 ) }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </x-artisanpack-card>

        {{-- Sites with Growth --}}
        <x-artisanpack-card :title="__( 'Site Growth' )" class="shadow-xl">
            <x-slot:menu>
                <x-artisanpack-select
                    wire:model.live="comparisonPeriod"
                    :options="[
                        [ 'id' => 'previous', 'name' => __( 'vs Previous Period' ) ],
                        [ 'id' => 'year', 'name' => __( 'vs Last Year' ) ],
                    ]"
                    option-value="id"
                    option-label="name"
                    class="select-xs"
                />
            </x-slot:menu>

            @if ( $this->sitesWithGrowth->isEmpty() )
                <div class="py-8 text-center text-base-content/50">
                    {{ __( 'No growth data available for this period.' ) }}
                </div>
            @else
                <div class="overflow-x-auto">
                    <table class="table table-sm" aria-label="{{ __( 'Sites with growth metrics' ) }}">
                        <thead>
                            <tr>
                                <th scope="col">{{ __( 'Site' ) }}</th>
                                <th scope="col" class="text-right">{{ __( 'Current' ) }}</th>
                                <th scope="col" class="text-right">{{ __( 'Previous' ) }}</th>
                                <th scope="col" class="text-right">{{ __( 'Growth' ) }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ( $this->sitesWithGrowth as $site )
                                @php
                                    $growthPercent = $site->growth_percent ?? 0;
                                    $isPositive = $growthPercent >= 0;
                                @endphp
                                <tr>
                                    <td>
                                        <div class="font-medium">{{ $site->name }}</div>
                                    </td>
                                    <td class="text-right">{{ number_format( $site->current_visitors ?? 0 ) }}</td>
                                    <td class="text-right">{{ number_format( $site->previous_visitors ?? 0 ) }}</td>
                                    <td class="text-right">
                                        <span class="{{ $isPositive ? 'text-success' : 'text-error' }} flex items-center justify-end gap-1">
                                            <x-artisanpack-icon :name="$isPositive ? 'o-arrow-up' : 'o-arrow-down'" class="w-4 h-4" />
                                            {{ number_format( abs( $growthPercent ), 1 ) }}%
                                        </span>
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </x-artisanpack-card>
    </div>

    {{-- Loading Indicator --}}
    <div wire:loading.delay class="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
        <div class="p-4 rounded-lg bg-base-100">
            <x-artisanpack-loading class="loading-lg text-primary" />
            <span class="sr-only">{{ __( 'Loading...' ) }}</span>
        </div>
    </div>
</div>
