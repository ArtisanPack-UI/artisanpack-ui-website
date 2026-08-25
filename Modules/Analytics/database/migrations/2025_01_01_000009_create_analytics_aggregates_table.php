<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_aggregates table.
 *
 * Pre-computed aggregates for fast dashboard queries.
 *
 * @since 1.0.0
 */
return new class extends Migration
{
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create( 'analytics_aggregates', function ( Blueprint $table ) {
			$table->id();
			$table->foreignId( 'site_id' )->nullable()->index();

			// Time dimension
			$table->date( 'date' );
			$table->string( 'period', 10 )->default( 'day' );
			$table->unsignedTinyInteger( 'hour' )->nullable();

			// Metric identification
			$table->string( 'metric', 50 );

			// Dimension (optional grouping)
			$table->string( 'dimension', 50 )->nullable();
			$table->string( 'dimension_value', 255 )->nullable();

			// Aggregated values
			$table->bigInteger( 'value' )->default( 0 );
			$table->decimal( 'value_sum', 20, 4 )->nullable();
			$table->decimal( 'value_avg', 20, 4 )->nullable();
			$table->decimal( 'value_min', 20, 4 )->nullable();
			$table->decimal( 'value_max', 20, 4 )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamps();

			// Foreign key
			$table->foreign( 'site_id', 'analytics_aggregates_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			// Indexes
			$table->unique(
				[ 'site_id', 'date', 'period', 'hour', 'metric', 'dimension', 'dimension_value' ],
				'unique_aggregate'
			);
			$table->index( [ 'site_id', 'date', 'metric' ] );
			$table->index( [ 'site_id', 'period', 'date' ] );
			$table->index( [ 'metric', 'date' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_aggregates' );
	}
};
