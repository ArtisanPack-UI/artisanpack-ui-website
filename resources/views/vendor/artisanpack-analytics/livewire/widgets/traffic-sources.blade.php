<div>
	{{-- Loading State --}}
	@if ( $isLoading )
		<x-artisanpack-card>
			<div class="h-4 bg-base-300 rounded w-1/4 mb-4 animate-pulse"></div>
			<div class="flex gap-4">
				<div class="h-48 w-48 bg-base-300 rounded-full animate-pulse"></div>
				<div class="flex-1 space-y-2">
					@foreach ( range( 1, 5 ) as $i )
						<div class="h-4 bg-base-300 rounded animate-pulse"></div>
					@endforeach
				</div>
			</div>
		</x-artisanpack-card>
	@else
		<x-artisanpack-card :title="__( 'Traffic Sources' )">
			<x-slot:menu>
				<x-artisanpack-button
					wire:click="refreshData"
					class="btn-ghost btn-xs"
					icon="o-arrow-path"
					spinner
					:tooltip="__( 'Refresh' )"
				/>
			</x-slot:menu>

				@if ( $sources->isEmpty() )
					<div class="flex flex-col items-center justify-center py-8 text-base-content/50">
						<x-artisanpack-icon name="o-globe-alt" class="w-12 h-12 mb-2" />
						<p>{{ __( 'No traffic source data available' ) }}</p>
					</div>
				@else
					<div class="flex flex-col lg:flex-row gap-6">
						{{-- Chart --}}
						@if ( $showChart )
							<div
								class="w-full lg:w-1/2"
								style="height: 250px"
								x-data="{
									chart: null,
									init() {
										this.renderChart();
										$wire.on('chartDataUpdated', () => {
											this.renderChart();
										});
									},
									renderChart() {
										if (this.chart) {
											this.chart.destroy();
										}
										const ctx = this.$refs.canvas.getContext('2d');
										const config = @js( $this->getChartConfig() );
										if (config.options?.plugins?.tooltip?.usePercentageLabel) {
											config.options.plugins.tooltip.callbacks = {
												label: function(context) {
													const total = context.dataset.data.reduce((a, b) => a + b, 0);
													const percentage = ((context.raw / total) * 100).toFixed(1);
													return context.label + ': ' + context.raw + ' (' + percentage + '%)';
												}
											};
											delete config.options.plugins.tooltip.usePercentageLabel;
										}
										this.chart = new Chart(ctx, config);
									}
								}"
								x-init="init"
								wire:ignore
							>
								<canvas x-ref="canvas"></canvas>
							</div>
						@endif

						{{-- Table --}}
						<div class="w-full {{ $showChart ? 'lg:w-1/2' : '' }}">
							<div class="overflow-x-auto">
								<table class="table table-sm">
									<thead>
										<tr>
											<th>{{ __( 'Source' ) }}</th>
											<th class="text-right">{{ __( 'Sessions' ) }}</th>
											<th class="text-right">{{ __( '%' ) }}</th>
										</tr>
									</thead>
									<tbody>
										@php
											$totalSessions = $this->getTotalSessions();
										@endphp
										@foreach ( $sources as $source )
											<tr class="hover:bg-base-200/50">
												<td>
													<div class="flex flex-col">
														<span class="font-medium">
															{{ $source['source'] ?? __( 'Direct' ) }}
														</span>
														@if ( ! empty( $source['medium'] ) )
															<span class="text-xs text-base-content/50">
																{{ $source['medium'] }}
															</span>
														@endif
													</div>
												</td>
												<td class="text-right font-mono">
													{{ number_format( $source['sessions'] ?? 0 ) }}
												</td>
												<td class="text-right font-mono text-base-content/70">
													@if ( $totalSessions > 0 )
														{{ number_format( ( ( $source['sessions'] ?? 0 ) / $totalSessions ) * 100, 1 ) }}%
													@else
														0%
													@endif
												</td>
											</tr>
										@endforeach
									</tbody>
								</table>
							</div>
						</div>
					</div>
				@endif
		</x-artisanpack-card>
	@endif
</div>
