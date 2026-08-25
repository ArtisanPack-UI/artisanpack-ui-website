<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Create the analytics_bot_whitelist table.
 *
 * Stores user agent patterns and IP addresses that bypass bot scoring,
 * managed at runtime via the analytics:whitelist command. These entries
 * supplement the static config whitelist.
 *
 * @since 1.2.0
 */
return new class extends Migration
{
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create( 'analytics_bot_whitelist', function ( Blueprint $table ) {
			$table->id();
			$table->string( 'type', 20 );
			$table->string( 'value' );
			$table->timestamps();

			$table->unique( [ 'type', 'value' ] );
			$table->index( 'type' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'analytics_bot_whitelist' );
	}
};
