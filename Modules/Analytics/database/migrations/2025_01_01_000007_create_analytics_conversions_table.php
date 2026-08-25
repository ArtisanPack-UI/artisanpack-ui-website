<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_conversions table.
 *
 * Records goal completions with associated value and metadata.
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
		Schema::create( 'analytics_conversions', function ( Blueprint $table ) {
			$table->id();
			$table->foreignId( 'site_id' )->nullable()->index();
			$table->foreignId( 'goal_id' );
			$table->uuid( 'session_id' )->nullable();
			$table->uuid( 'visitor_id' )->nullable();
			$table->foreignId( 'event_id' )->nullable();
			$table->foreignId( 'page_view_id' )->nullable();

			// Conversion value
			$table->decimal( 'value', 15, 4 )->nullable();

			// Metadata
			$table->json( 'metadata' )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamp( 'created_at' )->useCurrent();

			// Foreign keys
			$table->foreign( 'site_id', 'analytics_conversions_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			$table->foreign( 'goal_id', 'analytics_conversions_goal_id_fk' )
				->references( 'id' )
				->on( 'analytics_goals' )
				->cascadeOnDelete();

			$table->foreign( 'session_id', 'analytics_conversions_session_id_fk' )
				->references( 'id' )
				->on( 'analytics_sessions' )
				->nullOnDelete();

			$table->foreign( 'visitor_id', 'analytics_conversions_visitor_id_fk' )
				->references( 'id' )
				->on( 'analytics_visitors' )
				->nullOnDelete();

			$table->foreign( 'event_id', 'analytics_conversions_event_id_fk' )
				->references( 'id' )
				->on( 'analytics_events' )
				->nullOnDelete();

			$table->foreign( 'page_view_id', 'analytics_conversions_page_view_id_fk' )
				->references( 'id' )
				->on( 'analytics_page_views' )
				->nullOnDelete();

			// Indexes
			$table->index( [ 'site_id', 'goal_id' ] );
			$table->index( [ 'site_id', 'created_at' ] );
			$table->index( [ 'goal_id', 'created_at' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_conversions' );
	}
};
