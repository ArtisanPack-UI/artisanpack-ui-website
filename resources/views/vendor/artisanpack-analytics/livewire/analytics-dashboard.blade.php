<div>
	{{-- Dashboard Header --}}
	<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
		<h1 class="text-2xl font-bold text-base-content">
			{{ __( 'Analytics Dashboard' ) }}
		</h1>

		<div class="flex flex-wrap items-center gap-2">
			{{-- Date Range Selector --}}
			<x-artisanpack-dropdown right>
				<x-slot:trigger>
					<x-artisanpack-button icon="o-calendar" :label="$this->getDateRangeLabel()" icon-right="o-chevron-down" class="btn-sm btn-outline" />
				</x-slot:trigger>
				@foreach ( $this->getDateRangePresets() as $preset => $label )
					<x-artisanpack-menu-item
						wire:click="setDateRange('{{ $preset }}')"
						:title="$label"
						:active="$dateRangePreset === $preset"
					/>
				@endforeach
			</x-artisanpack-dropdown>

			{{-- Export Dropdown --}}
			<x-artisanpack-dropdown right>
				<x-slot:trigger>
					<x-artisanpack-button icon="o-arrow-down-tray" :label="__( 'Export' )" class="btn-sm btn-outline" />
				</x-slot:trigger>
				<x-artisanpack-menu-item
					wire:click="exportCsv"
					:title="__( 'CSV' )"
					icon="o-document-text"
				/>
				<x-artisanpack-menu-item
					wire:click="exportJson"
					:title="__( 'JSON' )"
					icon="o-code-bracket"
				/>
			</x-artisanpack-dropdown>

			{{-- Bot Traffic Toggle --}}
			<x-artisanpack-button
				wire:click="toggleBots"
				class="btn-sm {{ $includeBots ? 'btn-primary' : 'btn-outline' }}"
				icon="o-bug-ant"
				:label="$includeBots ? __( 'Exclude bots' ) : __( 'Include bots' )"
				:tooltip="$includeBots ? __( 'Bot traffic is included. Click to exclude.' ) : __( 'Bot traffic is excluded. Click to include.' )"
				aria-pressed="{{ $includeBots ? 'true' : 'false' }}"
			/>

			{{-- Refresh Button --}}
			<x-artisanpack-button
				wire:click="refreshData"
				class="btn-sm btn-outline"
				icon="o-arrow-path"
				spinner
				:tooltip="__( 'Refresh' )"
			/>
		</div>
	</div>

	{{-- Tabs --}}
	<div class="tabs tabs-boxed mb-6">
		@foreach ( $this->getTabs() as $key => $tab )
			<x-artisanpack-button
				wire:click="switchTab('{{ $key }}')"
				class="tab gap-2 {{ $activeTab === $key ? 'tab-active' : '' }}"
				:icon="'o-' . $tab['icon']"
				:label="$tab['label']"
			/>
		@endforeach
	</div>

	{{-- Loading Overlay --}}
	<div wire:loading.flex wire:target="refreshData, switchTab, setDateRange" class="fixed inset-0 bg-base-100/50 z-50 items-center justify-center">
		<x-artisanpack-loading class="loading-lg text-primary" />
	</div>

	{{-- Tab Content --}}
	<div class="space-y-6">
		{{-- Overview Tab --}}
		@if ( $activeTab === 'overview' )
			{{-- Stats Cards --}}
			<livewire:artisanpack-analytics::widgets.stats-cards
				:date-range-preset="$dateRangePreset"
				:site-id="$siteId"
				:stats="$stats"
			/>

			{{-- Chart --}}
			<x-artisanpack-card :title="__( 'Visitors Over Time' )">
				<div
					style="height: 300px; position: relative;"
					wire:ignore
				>
					<canvas id="visitors-chart-canvas"></canvas>
				</div>
			</x-artisanpack-card>

			<script>
				document.addEventListener('DOMContentLoaded', function() {
					const canvas = document.getElementById('visitors-chart-canvas');
					if (canvas && typeof Chart !== 'undefined') {
						new Chart(canvas, {
							type: 'line',
							data: @js( $chartData ),
							options: {
								responsive: true,
								maintainAspectRatio: false,
								plugins: {
									legend: {
										position: 'bottom',
									}
								},
								scales: {
									y: {
										beginAtZero: true
									}
								}
							}
						});
					}
				});
			</script>

			{{-- Quick Stats Row --}}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{{-- Top Pages Preview --}}
				<x-artisanpack-card :title="__( 'Top Pages' )">
					<x-slot:menu>
						<x-artisanpack-button
							wire:click="switchTab('pages')"
							class="btn-ghost btn-xs"
							:label="__( 'View All' )"
						/>
					</x-slot:menu>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<tbody>
								@forelse ( $topPages->take( 5 ) as $page )
									<tr class="hover:bg-base-200/50">
										<td class="max-w-xs truncate">{{ $page['path'] }}</td>
										<td class="text-right font-mono">{{ number_format( $page['views'] ?? 0 ) }}</td>
									</tr>
								@empty
									<tr>
										<td colspan="2" class="text-center text-base-content/50">
											{{ __( 'No data available' ) }}
										</td>
									</tr>
								@endforelse
							</tbody>
						</table>
					</div>
				</x-artisanpack-card>

				{{-- Traffic Sources Preview --}}
				<x-artisanpack-card :title="__( 'Traffic Sources' )">
					<x-slot:menu>
						<x-artisanpack-button
							wire:click="switchTab('traffic')"
							class="btn-ghost btn-xs"
							:label="__( 'View All' )"
						/>
					</x-slot:menu>
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<tbody>
								@forelse ( $trafficSources->take( 5 ) as $source )
									<tr class="hover:bg-base-200/50">
										<td>{{ $source['source'] ?? __( 'Direct' ) }}</td>
										<td class="text-right font-mono">{{ number_format( $source['sessions'] ?? 0 ) }}</td>
									</tr>
								@empty
									<tr>
										<td colspan="2" class="text-center text-base-content/50">
											{{ __( 'No data available' ) }}
										</td>
									</tr>
								@endforelse
							</tbody>
						</table>
					</div>
				</x-artisanpack-card>
			</div>
		@endif

		{{-- Pages Tab --}}
		@if ( $activeTab === 'pages' )
			<livewire:artisanpack-analytics::widgets.top-pages
				:date-range-preset="$dateRangePreset"
				:site-id="$siteId"
				:limit="20"
			/>
		@endif

		{{-- Traffic Tab --}}
		@if ( $activeTab === 'traffic' )
			<livewire:artisanpack-analytics::widgets.traffic-sources
				:date-range-preset="$dateRangePreset"
				:site-id="$siteId"
				:limit="15"
				:show-chart="true"
			/>
		@endif

		{{-- Audience Tab --}}
		@if ( $activeTab === 'audience' )
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{{-- Device Breakdown --}}
				<x-artisanpack-card :title="__( 'Devices' )">
					@if ( $deviceBreakdown->isEmpty() )
						<div class="flex flex-col items-center justify-center py-8 text-base-content/50">
							<x-artisanpack-icon name="o-device-phone-mobile" class="w-12 h-12 mb-2" />
							<p>{{ __( 'No device data available' ) }}</p>
						</div>
					@else
						<div class="space-y-3">
							@php
								$totalDeviceSessions = $deviceBreakdown->sum( 'sessions' );
							@endphp
							@foreach ( $deviceBreakdown as $device )
								<div>
									<div class="flex items-center justify-between mb-1">
										<span class="text-sm font-medium">{{ ucfirst( $device['device'] ?? __( 'Unknown' ) ) }}</span>
										<span class="text-sm text-base-content/70">{{ number_format( $device['sessions'] ?? 0 ) }}</span>
									</div>
									<x-artisanpack-progress
										class="progress-primary w-full"
										:value="$totalDeviceSessions > 0 ? ( ( $device['sessions'] ?? 0 ) / $totalDeviceSessions ) * 100 : 0"
										:max="100"
									/>
								</div>
							@endforeach
						</div>
					@endif
				</x-artisanpack-card>

				{{-- Browser Breakdown --}}
				<x-artisanpack-card :title="__( 'Browsers' )">
					@if ( $browserBreakdown->isEmpty() )
						<div class="flex flex-col items-center justify-center py-8 text-base-content/50">
							<x-artisanpack-icon name="o-globe-alt" class="w-12 h-12 mb-2" />
							<p>{{ __( 'No browser data available' ) }}</p>
						</div>
					@else
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<tbody>
									@foreach ( $browserBreakdown as $browser )
										<tr class="hover:bg-base-200/50">
											<td>{{ $browser['browser'] ?? __( 'Unknown' ) }}</td>
											<td class="text-right font-mono">{{ number_format( $browser['sessions'] ?? 0 ) }}</td>
										</tr>
									@endforeach
								</tbody>
							</table>
						</div>
					@endif
				</x-artisanpack-card>

				{{-- Country Breakdown --}}
				<x-artisanpack-card :title="__( 'Countries' )" class="lg:col-span-2">
					@if ( $countryBreakdown->isEmpty() )
						<div class="flex flex-col items-center justify-center py-8 text-base-content/50">
							<x-artisanpack-icon name="o-map" class="w-12 h-12 mb-2" />
							<p>{{ __( 'No country data available' ) }}</p>
						</div>
					@else
						<div class="overflow-x-auto">
							<table class="table table-sm">
								<thead>
									<tr>
										<th>{{ __( 'Country' ) }}</th>
										<th class="text-right">{{ __( 'Sessions' ) }}</th>
										<th class="text-right">{{ __( 'Visitors' ) }}</th>
									</tr>
								</thead>
								<tbody>
									@foreach ( $countryBreakdown as $country )
										<tr class="hover:bg-base-200/50">
											<td class="flex items-center gap-2">
												@if ( ! empty( $country['country_code'] ) )
													<span class="text-xl">{{ country_flag( $country['country_code'] ) }}</span>
												@endif
												{{ $country['country'] ?? __( 'Unknown' ) }}
											</td>
											<td class="text-right font-mono">{{ number_format( $country['sessions'] ?? 0 ) }}</td>
											<td class="text-right font-mono">{{ number_format( $country['visitors'] ?? 0 ) }}</td>
										</tr>
									@endforeach
								</tbody>
							</table>
						</div>
					@endif
				</x-artisanpack-card>
			</div>
		@endif

		{{-- Bots Tab --}}
		@if ( $activeTab === 'bots' )
			<livewire:artisanpack-analytics::widgets.bot-traffic
				:date-range-preset="$dateRangePreset"
				:site-id="$siteId"
				:limit="10"
			/>
		@endif
	</div>
</div>
