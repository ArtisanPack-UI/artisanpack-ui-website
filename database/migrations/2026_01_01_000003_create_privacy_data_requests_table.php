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
		Schema::create( 'privacy_data_requests', function ( Blueprint $table ): void {
			$table->id();
			$table->morphs( 'requestable' );
			$table->string( 'type' );
			$table->string( 'status' )->default( 'pending' );
			$table->string( 'regulation' )->nullable();
			$table->text( 'reason' )->nullable();
			$table->json( 'data' )->nullable();
			$table->string( 'verification_token' )->nullable();
			$table->timestamp( 'verified_at' )->nullable();
			$table->timestamp( 'due_at' )->nullable();
			$table->timestamp( 'completed_at' )->nullable();
			$table->unsignedBigInteger( 'processed_by' )->nullable();
			$table->text( 'admin_notes' )->nullable();
			$table->timestamps();

			$table->index( [ 'status', 'due_at' ] );
			$table->index( 'type' );
			$table->index( 'processed_by' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_data_requests' );
	}
};
