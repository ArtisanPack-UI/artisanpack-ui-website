<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Add multi-tenant fields to the analytics_sites table.
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
		// Step 1: Add columns (uuid as nullable first)
		Schema::table( 'analytics_sites', function ( Blueprint $table ) {
			// UUID for external references (nullable initially for existing rows)
			$table->uuid( 'uuid' )->nullable()->after( 'id' );

			// Polymorphic tenant relationship
			$table->string( 'tenant_type' )->nullable()->after( 'uuid' );
			$table->string( 'tenant_id' )->nullable()->after( 'tenant_type' );

			// Currency for monetary values
			$table->string( 'currency', 3 )->default( 'USD' )->after( 'timezone' );

			// Feature flags
			$table->boolean( 'tracking_enabled' )->default( true )->after( 'is_active' );
			$table->boolean( 'public_dashboard' )->default( false )->after( 'tracking_enabled' );

			// API key management (stored as hash for security)
			$table->string( 'api_key_hash', 64 )->nullable()->unique()->after( 'settings' );
			$table->timestamp( 'api_key_last_used_at' )->nullable()->after( 'api_key_hash' );

			// Soft deletes
			$table->softDeletes();

			// Indexes
			$table->index( [ 'tenant_type', 'tenant_id' ], 'sites_tenant_index' );
			$table->index( 'tracking_enabled' );
			$table->index( 'public_dashboard' );
		} );

		// Step 2: Generate UUIDs for existing rows
		DB::table( 'analytics_sites' )
			->whereNull( 'uuid' )
			->orderBy( 'id' )
			->chunk( 100, function ( $sites ): void {
				foreach ( $sites as $site ) {
					DB::table( 'analytics_sites' )
						->where( 'id', $site->id )
						->update( [ 'uuid' => Str::uuid()->toString() ] );
				}
			} );

		// Step 3: Make uuid non-nullable and add unique constraint
		Schema::table( 'analytics_sites', function ( Blueprint $table ) {
			$table->uuid( 'uuid' )->nullable( false )->unique()->change();
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::table( 'analytics_sites', function ( Blueprint $table ) {
			$table->dropSoftDeletes();
			$table->dropIndex( 'sites_tenant_index' );
			$table->dropIndex( [ 'tracking_enabled' ] );
			$table->dropIndex( [ 'public_dashboard' ] );
			$table->dropColumn( [
				'uuid',
				'tenant_type',
				'tenant_id',
				'currency',
				'tracking_enabled',
				'public_dashboard',
				'api_key_hash',
				'api_key_last_used_at',
			] );
		} );
	}
};
