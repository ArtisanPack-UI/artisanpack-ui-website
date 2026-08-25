<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_consents table.
 *
 * Tracks user consent for analytics tracking.
 *
 * Privacy Note: This table stores ip_address and user_agent for audit purposes
 * to document when and how consent was given/revoked. Applications should:
 * - Hash IP addresses in the application layer before storage
 * - Truncate user agents to browser/OS family only if full string not needed
 * - Purge records according to expires_at and data retention policies
 * - Consider if visitor_id alone is sufficient for your compliance needs
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
		Schema::create( 'analytics_consents', function ( Blueprint $table ) {
			$table->id();
			$table->foreignId( 'site_id' )->nullable()->index();
			$table->uuid( 'visitor_id' )->nullable();

			// Consent details
			$table->string( 'category', 50 )->default( 'analytics' );
			$table->boolean( 'granted' );

			// Tracking
			$table->string( 'ip_address', 45 )->nullable();
			$table->string( 'user_agent', 500 )->nullable();

			// Timestamps
			$table->timestamp( 'granted_at' )->nullable();
			$table->timestamp( 'revoked_at' )->nullable();
			$table->timestamp( 'expires_at' )->nullable();

			// Multi-tenant support
			$table->string( 'tenant_id' )->nullable()->index();

			$table->timestamps();

			// Foreign keys
			$table->foreign( 'site_id', 'analytics_consents_site_id_fk' )
				->references( 'id' )
				->on( 'analytics_sites' )
				->nullOnDelete();

			$table->foreign( 'visitor_id', 'analytics_consents_visitor_id_fk' )
				->references( 'id' )
				->on( 'analytics_visitors' )
				->cascadeOnDelete();

			// Indexes
			$table->index( [ 'site_id', 'visitor_id' ] );
			$table->index( [ 'site_id', 'category' ] );
			$table->index( 'expires_at' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_consents' );
	}
};
