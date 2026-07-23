<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_sessions table.
 *
 * Tracks visitor sessions with timing and source information.
 *
 * Note: This table uses two UUID columns intentionally:
 * - `id`: Internal database primary key used for foreign key relationships
 *   (page_views, events, conversions reference sessions via this column).
 * - `session_id`: Client-provided session identifier for correlation. This
 *   allows looking up sessions by the client's session token without exposing
 *   internal database IDs.
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
		Schema::create( 'analytics_sessions', function ( Blueprint $table ) {
			$table->uuid( 'id' )->primary();
			$table->foreignId( 'site_id' )->nullable()->index();
			$table->uuid( 'visitor_id' );
			$table->uuid( 'session_id' )->unique();

			// Timing
			$table->timestamp( 'started_at' );
			$table->timestamp( 'ended_at' )->nullable();
			$table->timestamp( 'last_activity_at' );
			$table->unsignedInteger( 'duration' )->default( 0 );

			// Navigation
			$table->string( 'entry_page', 2048 );
			$table->string( 'exit_page', 2048 )->nullable();
			$table->unsignedSmallInteger( 'page_count' )->default( 0 );
			$table->boolean( 'is_bounce' )->default( true );

			// Source
			$table->string( 'referrer', 2048 )->nullable();
			$table->string( 'referrer_domain', 255 )->nullable();
			$table->string( 'referrer_type', 20 )->default( 'direct' );

			// UTM Parameters
			$table->string( 'utm_source', 255 )->nullable();
			$table->string( 'utm_medium', 255 )->nullable();
			$table->string( 'utm_campaign', 255 )->nullable();
			$table->string( 'utm_term', 255 )->nullable();
			$table->string( 'utm_content', 255 )->nullable();

			// Landing page data
			$table->string( 'landing_page_title', 500 )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamps();

			// Foreign keys
			$table->foreign( 'site_id', 'analytics_sessions_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			$table->foreign( 'visitor_id', 'analytics_sessions_visitor_id_fk' )
				->references( 'id' )
				->on( 'analytics_visitors' )
				->cascadeOnDelete();

			// Indexes
			$table->index( [ 'site_id', 'visitor_id' ] );
			$table->index( [ 'site_id', 'started_at' ] );
			$table->index( [ 'site_id', 'ended_at' ] );
			$table->index( [ 'site_id', 'referrer_type' ] );
			$table->index( [ 'site_id', 'utm_source' ] );
			$table->index( [ 'site_id', 'is_bounce', 'started_at' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_sessions' );
	}
};
