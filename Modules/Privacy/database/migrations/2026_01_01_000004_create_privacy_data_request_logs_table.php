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
		Schema::create( 'privacy_data_request_logs', function ( Blueprint $table ): void {
			$table->id();
			$table->foreignId( 'data_request_id' )
				->constrained( 'privacy_data_requests' )
				->cascadeOnDelete();
			$table->string( 'action' );
			$table->text( 'description' )->nullable();
			$table->json( 'metadata' )->nullable();
			$table->unsignedBigInteger( 'performed_by' )->nullable();
			$table->timestamps();

			$table->index( 'action' );
			$table->index( 'performed_by' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_data_request_logs' );
	}
};
