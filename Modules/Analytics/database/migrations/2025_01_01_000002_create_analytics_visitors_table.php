<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_visitors table.
 *
 * Stores unique visitor profiles based on fingerprinting.
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
		Schema::create( 'analytics_visitors', function ( Blueprint $table ) {
			$table->uuid( 'id' )->primary();
			$table->foreignId( 'site_id' )->nullable()->index();
			$table->string( 'fingerprint', 64 );
			$table->foreignId( 'user_id' )->nullable()->index();

			// First and last activity
			$table->timestamp( 'first_seen_at' );
			$table->timestamp( 'last_seen_at' );

			// Anonymized/hashed data
			$table->string( 'ip_address', 45 )->nullable();
			$table->string( 'user_agent', 500 )->nullable();

			// Geo data
			$table->string( 'country', 2 )->nullable();
			$table->string( 'region', 100 )->nullable();
			$table->string( 'city', 100 )->nullable();

			// Device data
			$table->string( 'device_type', 20 )->default( 'other' );
			$table->string( 'browser', 50 )->nullable();
			$table->string( 'browser_version', 20 )->nullable();
			$table->string( 'os', 50 )->nullable();
			$table->string( 'os_version', 20 )->nullable();

			// Screen data
			$table->unsignedSmallInteger( 'screen_width' )->nullable();
			$table->unsignedSmallInteger( 'screen_height' )->nullable();
			$table->unsignedSmallInteger( 'viewport_width' )->nullable();
			$table->unsignedSmallInteger( 'viewport_height' )->nullable();

			// Preferences
			$table->string( 'language', 10 )->nullable();
			$table->string( 'timezone', 50 )->nullable();

			// Aggregates (denormalized for performance)
			$table->unsignedInteger( 'total_sessions' )->default( 0 );
			$table->unsignedInteger( 'total_pageviews' )->default( 0 );
			$table->unsignedInteger( 'total_events' )->default( 0 );

			// Multi-tenant support (generic, not FK)
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamps();

			// Foreign keys
			$table->foreign( 'site_id', 'analytics_visitors_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			// Indexes
			$table->unique( [ 'site_id', 'fingerprint' ] );
			$table->index( [ 'site_id', 'last_seen_at' ] );
			$table->index( [ 'site_id', 'first_seen_at' ] );
			$table->index( [ 'site_id', 'country' ] );
			$table->index( [ 'site_id', 'device_type' ] );
			$table->index( [ 'site_id', 'browser' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_visitors' );
	}
};
