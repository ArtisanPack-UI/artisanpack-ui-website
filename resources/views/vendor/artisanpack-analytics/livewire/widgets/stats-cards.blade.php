<div>
	{{-- Loading State --}}
	@if ( $isLoading )
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			@foreach ( range( 1, 4 ) as $i )
				<x-artisanpack-card class="animate-pulse">
					<div class="h-4 bg-base-300 rounded w-1/2 mb-2"></div>
					<div class="h-8 bg-base-300 rounded w-3/4"></div>
				</x-artisanpack-card>
			@endforeach
		</div>
	@else
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			@foreach ( $visibleStats as $statKey )
				@php
					$config = $this->getStatCardsConfig()[ $statKey ] ?? null;
					if ( ! $config ) {
						continue;
					}
					$value = $stats[ $config['key'] ] ?? 0;
					$formattedValue = $this->formatStatValue( $value, $config['format'] );
					$comparison = $stats['comparison'][ $config['key'] ] ?? null;
				@endphp

				<x-artisanpack-card class="hover:shadow-md transition-shadow">
					{{-- Header with icon --}}
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-medium text-base-content/70">
							{{ $config['label'] }}
						</h3>
						<div class="text-base-content/50">
							<x-artisanpack-icon :name="'o-' . $config['icon']" class="w-5 h-5" />
						</div>
					</div>

					{{-- Value --}}
					<div class="mt-2">
						<span class="text-3xl font-bold text-base-content">
							{{ $formattedValue }}
						</span>
					</div>

					{{-- Comparison --}}
					@if ( $showComparison && $comparison )
						<div class="mt-2 flex items-center gap-1 text-sm">
							@if ( $comparison['change'] != 0 )
								<span class="{{ $comparison['positive'] ? 'text-success' : 'text-error' }}">
									<x-artisanpack-icon :name="$comparison['change'] > 0 ? 'o-arrow-up' : 'o-arrow-down'" class="w-4 h-4 inline" />
									{{ abs( $comparison['change'] ) }}%
								</span>
							@else
								<span class="text-base-content/50">
									<x-artisanpack-icon name="o-minus" class="w-4 h-4 inline" />
									0%
								</span>
							@endif
							<span class="text-base-content/50">
								{{ __( 'vs previous period' ) }}
							</span>
						</div>
					@endif
				</x-artisanpack-card>
			@endforeach
		</div>
	@endif
</div>
