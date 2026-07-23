<div class="multi-tenant-dashboard">
	{{-- Header with Site Selector --}}
	<div class="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-white">
				{{ __( 'Analytics Dashboard' ) }}
			</h1>
			@if ( $currentSite )
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{{ $currentSite->domain ?? $currentSite->name }}
				</p>
			@endif
		</div>

		<div class="flex items-center gap-4">
			{{-- Site Selector (only in multi-tenant mode with multiple sites) --}}
			@if ( $showSiteSelector )
				<livewire:artisanpack-analytics::site-selector />
			@endif

			{{-- Date Range Selector --}}
			<x-artisanpack-select
				wire:model.live="dateRangePreset"
				:options="[
					[ 'id' => 'today', 'name' => __( 'Today' ) ],
					[ 'id' => 'yesterday', 'name' => __( 'Yesterday' ) ],
					[ 'id' => '7d', 'name' => __( 'Last 7 days' ) ],
					[ 'id' => '30d', 'name' => __( 'Last 30 days' ) ],
					[ 'id' => '90d', 'name' => __( 'Last 90 days' ) ],
					[ 'id' => '12m', 'name' => __( 'Last 12 months' ) ],
					[ 'id' => 'year', 'name' => __( 'This year' ) ],
				]"
				option-value="id"
				option-label="name"
				class="select-sm"
			/>
		</div>
	</div>

	{{-- Loading indicator during site change --}}
	<div
		wire:loading.flex
		wire:target="handleSiteChange"
		class="fixed inset-0 z-50 items-center justify-center bg-white/80 dark:bg-gray-900/80"
	>
		<div class="flex flex-col items-center gap-3">
			<x-artisanpack-loading class="w-10 h-10 text-blue-500" />
			<span class="text-sm font-medium text-gray-600 dark:text-gray-300">
				{{ __( 'Loading site data...' ) }}
			</span>
		</div>
	</div>

	{{-- Analytics Dashboard --}}
	@if ( $siteId )
		<livewire:artisanpack-analytics::analytics-dashboard
			:date-range-preset="$dateRangePreset"
			:site-id="$siteId"
			:key="'dashboard-' . $siteId"
		/>
	@else
		<x-artisanpack-card class="shadow">
			<div class="flex flex-col items-center justify-center p-8 text-center">
				<x-artisanpack-icon name="o-chart-bar" class="w-16 h-16 mb-4 text-gray-400" />
				<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
					{{ __( 'No Site Selected' ) }}
				</h3>
				<p class="text-gray-500 dark:text-gray-400">
					{{ __( 'Please select a site to view analytics data.' ) }}
				</p>
			</div>
		</x-artisanpack-card>
	@endif
</div>
