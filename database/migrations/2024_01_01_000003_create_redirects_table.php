<?php

/**
 * Create redirects table migration.
 *
 * Creates the redirects table for managing URL redirects.
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
		Schema::create( 'redirects', function ( Blueprint $table ) {
			$table->id();
			$table->string( 'from_path', 500 );
			$table->string( 'to_path', 500 );
			$table->smallInteger( 'status_code' )->default( 301 );
			$table->string( 'match_type', 20 )->default( 'exact' );
			$table->boolean( 'is_active' )->default( true );
			$table->unsignedBigInteger( 'hits' )->default( 0 );
			$table->timestamp( 'last_hit_at' )->nullable();
			$table->text( 'notes' )->nullable();
			$table->timestamps();

			$table->index( [ 'from_path', 'is_active' ] );
			$table->index( 'match_type' );
			$table->index( 'is_active' );
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
		Schema::dropIfExists( 'redirects' );
	}
};
