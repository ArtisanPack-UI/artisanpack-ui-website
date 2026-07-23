<?php

declare( strict_types=1 );

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
	/**
	 * Run the migrations.
	 */
	public function up(): void
	{
		Schema::create( 'privacy_scheduled_deletions', function ( Blueprint $table ): void {
			$table->id();
			$table->morphs( 'deletable' );
			$table->string( 'strategy' );
			$table->timestamp( 'scheduled_for' );
			$table->timestamp( 'processed_at' )->nullable();
			$table->timestamp( 'cancelled_at' )->nullable();
			$table->string( 'cancelled_reason' )->nullable();
			$table->unsignedBigInteger( 'requested_by' )->nullable();
			$table->json( 'options' )->nullable();
			$table->timestamps();

			$table->index( [ 'scheduled_for', 'processed_at' ] );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_scheduled_deletions' );
	}
};
