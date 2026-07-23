<div>
	{{-- Loading State --}}
	@if ( $isLoading )
		<x-artisanpack-card>
			<div class="h-4 bg-base-300 rounded w-1/4 mb-4 animate-pulse"></div>
			<div class="bg-base-300 rounded animate-pulse" style="height: {{ $height }}px"></div>
		</x-artisanpack-card>
	@else
		<x-artisanpack-card :title="__( 'Visitors Over Time' )">
			<x-slot:menu>
				{{-- Granularity Selector --}}
				<div class="flex gap-1">
					@foreach ( ['hour' => __( 'Hourly' ), 'day' => __( 'Daily' ), 'week' => __( 'Weekly' ), 'month' => __( 'Monthly' )] as $key => $label )
						<x-artisanpack-button
							wire:click="setGranularity('{{ $key }}')"
							:class="'btn-xs ' . ( $granularity === $key ? 'btn-primary' : 'btn-ghost' )"
							:label="$label"
						/>
					@endforeach
				</div>
			</x-slot:menu>

				{{-- Chart Container or Empty State --}}
				@if ( ! empty( $chartData['labels'] ) )
					<div
						style="height: {{ $height }}px"
						x-data="{
							chart: null,
							init() {
								this.$nextTick(() => {
									this.renderChart();
								});
								$wire.on('chartDataUpdated', () => {
									this.$nextTick(() => {
										this.renderChart();
									});
								});
							},
							renderChart() {
								if (this.chart) {
									this.chart.destroy();
								}
								if (!this.$refs.canvas) {
									return;
								}
								const ctx = this.$refs.canvas.getContext('2d');
								this.chart = new Chart(ctx, @js( $this->getChartConfig() ));
							}
						}"
						x-init="init"
						wire:ignore
					>
						<canvas x-ref="canvas"></canvas>
					</div>
				@else
					<div
						class="flex flex-col items-center justify-center text-base-content/50"
						style="height: {{ $height }}px"
					>
						<x-artisanpack-icon name="o-chart-bar" class="w-12 h-12 mb-2" />
						<p>{{ __( 'No data available for this period' ) }}</p>
					</div>
				@endif
		</x-artisanpack-card>
	@endif
</div>
