<?php

/**
 * Create seo_meta table migration.
 *
 * Creates the polymorphic seo_meta table for storing SEO metadata
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
		Schema::create( 'seo_meta', function ( Blueprint $table ) {
			$table->id();

			// Polymorphic relationship
			$table->morphs( 'seoable' );

			// Basic Meta Tags
			$table->string( 'meta_title', 255 )->nullable();
			$table->text( 'meta_description' )->nullable();
			$table->string( 'canonical_url', 500 )->nullable();
			$table->boolean( 'no_index' )->default( false );
			$table->boolean( 'no_follow' )->default( false );
			$table->string( 'robots_meta', 255 )->nullable();

			// Open Graph
			$table->string( 'og_title', 255 )->nullable();
			$table->text( 'og_description' )->nullable();
			$table->string( 'og_image', 500 )->nullable();
			$table->unsignedBigInteger( 'og_image_id' )->nullable();
			$table->string( 'og_type', 50 )->default( 'website' );
			$table->string( 'og_locale', 10 )->nullable();
			$table->string( 'og_site_name', 255 )->nullable();

			// Twitter Card
			$table->string( 'twitter_card', 50 )->default( 'summary_large_image' );
			$table->string( 'twitter_title', 255 )->nullable();
			$table->text( 'twitter_description' )->nullable();
			$table->string( 'twitter_image', 500 )->nullable();
			$table->unsignedBigInteger( 'twitter_image_id' )->nullable();
			$table->string( 'twitter_site', 50 )->nullable();
			$table->string( 'twitter_creator', 50 )->nullable();

			// Pinterest
			$table->text( 'pinterest_description' )->nullable();
			$table->string( 'pinterest_image', 500 )->nullable();
			$table->unsignedBigInteger( 'pinterest_image_id' )->nullable();

			// Slack
			$table->string( 'slack_title', 255 )->nullable();
			$table->text( 'slack_description' )->nullable();
			$table->string( 'slack_image', 500 )->nullable();
			$table->unsignedBigInteger( 'slack_image_id' )->nullable();

			// Schema.org
			$table->string( 'schema_type', 100 )->nullable();
			$table->json( 'schema_markup' )->nullable();

			// Focus Keyword
			$table->string( 'focus_keyword', 255 )->nullable();
			$table->json( 'secondary_keywords' )->nullable();

			// Multi-language
			$table->json( 'hreflang' )->nullable();

			// Sitemap
			$table->decimal( 'sitemap_priority', 2, 1 )->default( 0.5 );
			$table->string( 'sitemap_changefreq', 20 )->default( 'weekly' );
			$table->boolean( 'exclude_from_sitemap' )->default( false );

			$table->timestamps();

			// Additional indexes
			$table->index( 'focus_keyword' );
			$table->index( [ 'exclude_from_sitemap', 'sitemap_priority' ] );

			// Unique constraint on polymorphic relationship (enforce one SeoMeta per model)
			$table->unique( [ 'seoable_type', 'seoable_id' ] );
		} );

		// Add check constraint for sitemap_priority (0.0-1.0 range)
		// This provides database-level validation for supported databases
		try {
			DB::statement( 'ALTER TABLE seo_meta ADD CONSTRAINT chk_sitemap_priority CHECK (sitemap_priority >= 0 AND sitemap_priority <= 1)' );
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
		Schema::dropIfExists( 'seo_meta' );
	}
};
