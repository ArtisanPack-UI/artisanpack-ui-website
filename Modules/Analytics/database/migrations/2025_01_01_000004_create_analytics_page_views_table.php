<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_page_views table.
 *
 * Records individual page view events with timing and engagement metrics.
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
		Schema::create( 'analytics_page_views', function ( Blueprint $table ) {
			$table->id();
			$table->foreignId( 'site_id' )->nullable()->index();
			$table->uuid( 'session_id' );
			$table->uuid( 'visitor_id' );

			// Page data
			$table->string( 'path', 2048 );
			$table->string( 'title', 500 )->nullable();
			$table->string( 'hash', 255 )->nullable();
			$table->string( 'query_string', 2048 )->nullable();

			// Referrer (for internal navigation)
			$table->string( 'referrer_path', 2048 )->nullable();

			// Timing
			$table->unsignedInteger( 'time_on_page' )->nullable();
			$table->unsignedInteger( 'engaged_time' )->nullable();

			// Performance metrics
			$table->unsignedInteger( 'load_time' )->nullable();
			$table->unsignedInteger( 'dom_ready_time' )->nullable();
			$table->unsignedInteger( 'first_contentful_paint' )->nullable();

			// Scroll depth (percentage)
			$table->unsignedTinyInteger( 'scroll_depth' )->nullable();

			// Custom data
			$table->json( 'custom_data' )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamp( 'created_at' )->useCurrent();

			// Foreign keys
			$table->foreign( 'site_id', 'analytics_page_views_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			$table->foreign( 'session_id', 'analytics_page_views_session_id_fk' )
				->references( 'id' )
				->on( 'analytics_sessions' )
				->cascadeOnDelete();

			$table->foreign( 'visitor_id', 'analytics_page_views_visitor_id_fk' )
				->references( 'id' )
				->on( 'analytics_visitors' )
				->cascadeOnDelete();

			// Indexes
			$table->index( [ 'site_id', 'session_id' ] );
			$table->index( [ 'site_id', 'visitor_id' ] );
			$table->index( [ 'site_id', 'created_at' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_page_views' );
	}
};
