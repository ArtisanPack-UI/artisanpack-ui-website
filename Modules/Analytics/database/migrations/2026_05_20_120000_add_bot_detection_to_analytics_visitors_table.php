<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add bot detection columns to the analytics_visitors table.
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
		Schema::table( 'analytics_visitors', function ( Blueprint $table ) {
			$table->boolean( 'is_bot' )->default( false )->after( 'total_events' );
			$table->unsignedTinyInteger( 'bot_score' )->nullable()->after( 'is_bot' );
			$table->timestamp( 'bot_detected_at' )->nullable()->after( 'bot_score' );

			$table->index( 'is_bot' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::table( 'analytics_visitors', function ( Blueprint $table ) {
			$table->dropIndex( [ 'is_bot' ] );
			$table->dropColumn( [
				'is_bot',
				'bot_score',
				'bot_detected_at',
			] );
		} );
	}
};
