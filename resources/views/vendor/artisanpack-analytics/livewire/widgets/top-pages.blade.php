<div>
	{{-- Loading State --}}
	@if ( $isLoading )
		<x-artisanpack-card>
			<div class="h-4 bg-base-300 rounded w-1/4 mb-4 animate-pulse"></div>
			@foreach ( range( 1, 5 ) as $i )
				<div class="flex justify-between py-2 animate-pulse">
					<div class="h-4 bg-base-300 rounded w-2/3"></div>
					<div class="h-4 bg-base-300 rounded w-16"></div>
				</div>
			@endforeach
		</x-artisanpack-card>
	@else
		<x-artisanpack-card :title="__( 'Top Pages' )">
			<x-slot:menu>
				<x-artisanpack-button
					wire:click="refreshData"
					class="btn-ghost btn-xs"
					icon="o-arrow-path"
					spinner
					:tooltip="__( 'Refresh' )"
				/>
			</x-slot:menu>

				{{-- Table --}}
				@if ( $pages->isEmpty() )
					<div class="flex flex-col items-center justify-center py-8 text-base-content/50">
						<x-artisanpack-icon name="o-document-text" class="w-12 h-12 mb-2" />
						<p>{{ __( 'No page data available' ) }}</p>
					</div>
				@else
					<div class="overflow-x-auto">
						<table class="table table-sm">
							<thead>
								<tr>
									@foreach ( $this->getColumns() as $key => $column )
										<th
											@if ( $column['sortable'] )
												class="cursor-pointer hover:bg-base-200"
												wire:click="sortByColumn('{{ $key }}')"
												role="columnheader"
												aria-sort="{{ $sortBy === $key ? ( 'asc' === $sortDirection ? 'ascending' : 'descending' ) : 'none' }}"
											@endif
										>
											<div class="flex items-center gap-1">
												{{ $column['label'] }}
												@if ( $column['sortable'] && $sortBy === $key )
													<x-artisanpack-icon
														:name="$sortDirection === 'asc' ? 'o-chevron-up' : 'o-chevron-down'"
														class="w-3 h-3"
														aria-hidden="true"
													/>
												@endif
											</div>
										</th>
									@endforeach
								</tr>
							</thead>
							<tbody>
								@foreach ( $pages as $page )
									<tr class="hover:bg-base-200/50">
										<td class="max-w-xs truncate" title="{{ $page['path'] }}">
											<div class="flex flex-col">
												<span class="font-medium">{{ $page['path'] }}</span>
												@if ( ! empty( $page['title'] ) )
													<span class="text-xs text-base-content/50">{{ $page['title'] }}</span>
												@endif
											</div>
										</td>
										<td class="text-right font-mono">
											{{ number_format( $page['views'] ) }}
										</td>
										<td class="text-right font-mono">
											{{ number_format( $page['unique_views'] ) }}
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
