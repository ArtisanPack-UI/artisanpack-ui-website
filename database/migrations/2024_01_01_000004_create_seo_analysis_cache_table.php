<?php

/**
 * Create seo_analysis_cache table migration.
 *
 * Creates the table for caching SEO analysis results.
 *
 * @package    ArtisanPack_UI
 * @subpackage SEO
 *
 * @since      1.0.0
 */

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
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
		Schema::create( 'seo_analysis_cache', function ( Blueprint $table ) {
			$table->id();

			// Foreign key to seo_meta table (unique enforces one-to-one relation)
			$table->foreignId( 'seo_meta_id' )
				->unique()
				->constrained( 'seo_meta' )
				->cascadeOnDelete();

			// Overall and category scores (0-100)
			$table->unsignedTinyInteger( 'overall_score' )->default( 0 );
			$table->unsignedTinyInteger( 'readability_score' )->default( 0 );
			$table->unsignedTinyInteger( 'keyword_score' )->default( 0 );
			$table->unsignedTinyInteger( 'meta_score' )->default( 0 );
			$table->unsignedTinyInteger( 'content_score' )->default( 0 );

			// Analysis results
			$table->json( 'issues' )->nullable();
			$table->json( 'suggestions' )->nullable();
			$table->json( 'passed_checks' )->nullable();
			$table->json( 'analyzer_results' )->nullable();

			// Analysis metadata
			$table->timestamp( 'analyzed_at' )->nullable();
			$table->string( 'focus_keyword_used', 255 )->nullable();
			$table->unsignedInteger( 'content_word_count' )->default( 0 );

			$table->timestamps();

			// Indexes for common queries
			$table->index( 'overall_score' );
			$table->index( 'analyzed_at' );
		} );
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
		Schema::dropIfExists( 'seo_analysis_cache' );
	}
};
