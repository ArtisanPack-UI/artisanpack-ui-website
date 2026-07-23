<div wire:poll.{{ $pollingInterval }}ms="poll">
	<x-artisanpack-card :title="__( 'Active Visitors' )">
		<x-slot:menu>
			{{-- Polling Toggle --}}
			<x-artisanpack-button
				wire:click="togglePolling"
				class="btn-ghost btn-xs"
				:icon="$pollingEnabled ? 'o-pause' : 'o-play'"
				:tooltip="$pollingEnabled ? __( 'Pause updates' ) : __( 'Resume updates' )"
			/>
			{{-- Refresh Button --}}
			<x-artisanpack-button
				wire:click="refreshData"
				class="btn-ghost btn-xs"
				icon="o-arrow-path"
				spinner
				:tooltip="__( 'Refresh' )"
			/>
		</x-slot:menu>

			{{-- Main Display --}}
			<div class="flex flex-col items-center justify-center py-6">
				{{-- Status Indicator --}}
				<div class="relative mb-4">
					<div class="{{ $this->getStatusClass() }} {{ $this->getPulseClass() }}">
						<x-artisanpack-icon name="o-signal" class="w-8 h-8" />
					</div>
					@if ( $visitorCount > 0 )
						<span class="absolute -top-1 -right-1 flex h-3 w-3">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
							<span class="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
						</span>
					@endif
				</div>

				{{-- Visitor Count --}}
				<div
					class="text-5xl font-bold text-base-content mb-2"
					x-data="{ count: {{ $visitorCount }} }"
					x-init="$watch('$wire.visitorCount', value => {
						count = value;
					})"
				>
					<span x-text="count">{{ $visitorCount }}</span>
				</div>

				{{-- Label --}}
				<p class="text-base-content/70">
					{{ trans_choice( 'visitor online now|visitors online now', $visitorCount ) }}
				</p>

				{{-- Trend Indicator --}}
				@if ( $previousCount > 0 && $this->getTrend() !== 'stable' )
					<div class="mt-3 flex items-center gap-1 text-sm">
						@if ( $this->getTrend() === 'up' )
							<span class="text-success flex items-center gap-1">
								<x-artisanpack-icon name="o-arrow-up" class="w-4 h-4" />
								+{{ $this->getTrendDifference() }}
							</span>
						@else
							<span class="text-error flex items-center gap-1">
								<x-artisanpack-icon name="o-arrow-down" class="w-4 h-4" />
								-{{ $this->getTrendDifference() }}
							</span>
						@endif
						<span class="text-base-content/50">
							{{ __( 'since last update' ) }}
						</span>
					</div>
				@endif
			</div>

		{{-- Footer --}}
		<div class="flex items-center justify-between text-xs text-base-content/50">
			<span>
				{{ __( 'Active in last :minutes minutes', ['minutes' => $activeMinutes] ) }}
			</span>
			@if ( $lastUpdated )
				<span>
					{{ __( 'Updated' ) }}: {{ \Carbon\Carbon::parse( $lastUpdated )->diffForHumans() }}
				</span>
			@endif
		</div>
	</x-artisanpack-card>
</div>
