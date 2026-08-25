<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_goals table.
 *
 * Defines conversion goals and their matching conditions.
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
		Schema::create( 'analytics_goals', function ( Blueprint $table ) {
			$table->id();
			$table->foreignId( 'site_id' )->nullable()->index();

			// Goal definition
			$table->string( 'name', 255 );
			$table->text( 'description' )->nullable();

			// Goal type
			$table->string( 'type', 30 );

			// Matching conditions (JSON for flexibility)
			$table->json( 'conditions' );

			// Value assignment
			$table->string( 'value_type', 20 )->default( 'none' );
			$table->decimal( 'fixed_value', 15, 4 )->nullable();
			$table->string( 'dynamic_value_path', 255 )->nullable();

			// Status
			$table->boolean( 'is_active' )->default( true );

			// Funnel configuration (optional)
			$table->json( 'funnel_steps' )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamps();

			// Foreign key
			$table->foreign( 'site_id', 'analytics_goals_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			// Indexes
			$table->index( [ 'site_id', 'is_active' ] );
			$table->index( [ 'site_id', 'type' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_goals' );
	}
};
