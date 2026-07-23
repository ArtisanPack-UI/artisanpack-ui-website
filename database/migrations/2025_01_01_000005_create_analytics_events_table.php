<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_events table.
 *
 * Stores custom events and interactions.
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
		Schema::create( 'analytics_events', function ( Blueprint $table ) {
			$table->id();
			$table->foreignId( 'site_id' )->nullable()->index();
			$table->uuid( 'session_id' )->nullable();
			$table->uuid( 'visitor_id' )->nullable();
			$table->foreignId( 'page_view_id' )->nullable();

			// Event identification
			$table->string( 'name', 255 );
			$table->string( 'category', 100 )->nullable();
			$table->string( 'action', 100 )->nullable();
			$table->string( 'label', 255 )->nullable();

			// Event data
			$table->json( 'properties' )->nullable();
			$table->decimal( 'value', 15, 4 )->nullable();

			// Source tracking
			$table->string( 'source_package', 100 )->nullable();

			// Path where event occurred
			$table->string( 'path', 2048 )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamp( 'created_at' )->useCurrent();

			// Foreign keys
			$table->foreign( 'session_id', 'analytics_events_session_id_fk' )
				->references( 'id' )
				->on( 'analytics_sessions' )
				->nullOnDelete();

			$table->foreign( 'visitor_id', 'analytics_events_visitor_id_fk' )
				->references( 'id' )
				->on( 'analytics_visitors' )
				->nullOnDelete();

			$table->foreign( 'page_view_id', 'analytics_events_page_view_id_fk' )
				->references( 'id' )
				->on( 'analytics_page_views' )
				->nullOnDelete();

			// Indexes
			$table->index( [ 'site_id', 'name' ] );
			$table->index( [ 'site_id', 'category' ] );
			$table->index( [ 'site_id', 'session_id' ] );
			$table->index( [ 'site_id', 'created_at' ] );
			$table->index( [ 'name', 'created_at' ] );
			$table->index( [ 'site_id', 'source_package' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_events' );
	}
};
