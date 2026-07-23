<?php

/**
 * Create sitemap_entries table migration.
 *
 * Creates the polymorphic sitemap_entries table for storing sitemap data
 * for any model in the application.
 *
 * @package    ArtisanPack_UI
 * @subpackage SEO
 *
 * @since      1.0.0
 */

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	/**
	 * Run the migrations.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function up(): void
	{
		Schema::create( 'sitemap_entries', function ( Blueprint $table ) {
			$table->id();

			// Polymorphic relationship
			$table->morphs( 'sitemapable' );

			// URL and type
			$table->string( 'url', 500 )->unique();
			$table->string( 'type', 50 )->default( 'page' );

			// Sitemap metadata
			$table->timestamp( 'last_modified' )->nullable();
			$table->decimal( 'priority', 2, 1 )->default( 0.5 );
			$table->string( 'changefreq', 20 )->default( 'weekly' );
			$table->boolean( 'is_indexable' )->default( true );

			// Media for sitemap extensions
			$table->json( 'images' )->nullable();
			$table->json( 'videos' )->nullable();

			$table->timestamps();

			// Indexes for efficient querying
			$table->index( [ 'type', 'is_indexable' ] );
			$table->index( 'last_modified' );
		} );

		// Add check constraint for priority (0.0-1.0 range)
		// This provides database-level validation for supported databases
		try {
			DB::statement( 'ALTER TABLE sitemap_entries ADD CONSTRAINT chk_sitemap_entries_priority CHECK (priority >= 0 AND priority <= 1)' );
		} catch ( \Exception $e ) {
			// Silently ignore if database doesn't support check constraints
			// Model-level validation will still enforce the range
		}
	}

	/**
	 * Reverse the migrations.
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'sitemap_entries' );
	}
};
