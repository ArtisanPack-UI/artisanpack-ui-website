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
		Schema::create( 'privacy_breach_notifications', function ( Blueprint $table ): void {
			$table->id();
			$table->string( 'reference_number' )->unique();
			$table->timestamp( 'discovered_at' );
			$table->timestamp( 'occurred_at' )->nullable();
			$table->string( 'severity' );
			$table->text( 'description' );
			$table->json( 'data_types_affected' );
			$table->integer( 'records_affected' )->nullable();
			$table->json( 'affected_users' )->nullable();
			$table->text( 'cause' )->nullable();
			$table->text( 'remediation' )->nullable();
			$table->json( 'notifications_sent' )->nullable();
			$table->timestamp( 'authority_notified_at' )->nullable();
			$table->timestamp( 'users_notified_at' )->nullable();
			$table->string( 'status' )->default( 'investigating' );
			$table->unsignedBigInteger( 'reported_by' )->nullable();
			$table->timestamps();

			$table->index( [ 'severity', 'status' ] );
			$table->index( 'discovered_at' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_breach_notifications' );
	}
};
