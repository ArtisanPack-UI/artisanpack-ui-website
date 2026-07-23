<div>
	{{-- Loading State --}}
	@if ( $isLoading )
		<x-artisanpack-card>
			<div class="h-4 bg-base-300 rounded w-1/4 mb-4 animate-pulse"></div>
			<div class="grid grid-cols-2 gap-4 mb-4">
				<div class="h-16 bg-base-300 rounded animate-pulse"></div>
				<div class="h-16 bg-base-300 rounded animate-pulse"></div>
			</div>
			@foreach ( range( 1, 5 ) as $i )
				<div class="flex justify-between py-2 animate-pulse">
					<div class="h-4 bg-base-300 rounded w-2/3"></div>
					<div class="h-4 bg-base-300 rounded w-16"></div>
				</div>
			@endforeach
		</x-artisanpack-card>
	@else
		<x-artisanpack-card :title="__( 'Bot Traffic' )">
			<x-slot:menu>
				<x-artisanpack-button
					wire:click="refreshData"
					class="btn-ghost btn-xs"
					icon="o-arrow-path"
					spinner
					:tooltip="__( 'Refresh' )"
				/>
			</x-slot:menu>

			<p class="text-sm text-base-content/60 mb-4">
				{{ __( 'Traffic identified as bots and excluded from your reports by default.' ) }}
			</p>

			{{-- Summary stats --}}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
				<div class="rounded-box bg-base-200 p-4">
					<div class="text-xs uppercase tracking-wide text-base-content/50">
						{{ __( 'Bot visits' ) }}
					</div>
					<div class="text-2xl font-bold font-mono">
						{{ number_format( $botVisits ) }}
					</div>
				</div>
				<div class="rounded-box bg-base-200 p-4">
					<div class="text-xs uppercase tracking-wide text-base-content/50">
						{{ __( '% of total traffic' ) }}
					</div>
					<div class="text-2xl font-bold font-mono">
						{{ number_format( $botPercentage, 1 ) }}%
					</div>
				</div>
			</div>

			{{-- Trend sparkline --}}
			@if ( ! empty( $trend ) )
				@php( $trendMax = $this->getTrendMax() )
				<div class="mb-6">
					<div class="text-xs uppercase tracking-wide text-base-content/50 mb-2">
						{{ __( 'Bot traffic trend' ) }}
					</div>
					<div
						class="flex items-end gap-px h-16"
						role="img"
						aria-label="{{ __( 'Bot visits over time for the selected date range.' ) }}"
					>
						@foreach ( $trend as $point )
							<div
								class="flex-1 bg-primary/60 rounded-t min-h-[2px]"
								style="height: {{ max( 2, (int) round( ( $point['visits'] / $trendMax ) * 100 ) ) }}%"
								title="{{ $point['date'] }}: {{ number_format( $point['visits'] ) }}"
							></div>
						@endforeach
					</div>
				</div>
			@endif

			{{-- Top bot user agents --}}
			@if ( $topAgents->isEmpty() )
				<div class="flex flex-col items-center justify-center py-8 text-base-content/50">
					<x-artisanpack-icon name="o-bug-ant" class="w-12 h-12 mb-2" />
					<p>{{ __( 'No bot traffic detected for this period' ) }}</p>
				</div>
			@else
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr>
								<th>{{ __( 'Bot user agent' ) }}</th>
								<th class="text-right">{{ __( 'Visits' ) }}</th>
							</tr>
						</thead>
						<tbody>
							@foreach ( $topAgents as $agent )
								<tr class="hover:bg-base-200/50" wire:key="bot-agent-{{ md5( $agent['user_agent'] ) }}">
									<td class="max-w-md truncate" title="{{ $agent['user_agent'] }}">
										<span class="font-mono text-xs">{{ $agent['user_agent'] }}</span>
									</td>
									<td class="text-right font-mono">
										{{ number_format( $agent['visits'] ) }}
									</td>
								</tr>
							@endforeach
						</tbody>
					</table>
				</div>
			@endif
		</x-artisanpack-card>
	@endif
</div>
