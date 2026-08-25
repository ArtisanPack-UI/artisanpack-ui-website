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
		Schema::table( 'privacy_data_requests', function ( Blueprint $table ): void {
			$table->char( 'verification_token_hash', 64 )->nullable()->after( 'verification_token' );
			$table->unique( 'verification_token_hash', 'privacy_data_requests_token_hash_unique' );
			$table->unique( 'verification_token', 'privacy_data_requests_token_unique' );
		} );

		Schema::table( 'privacy_policies', function ( Blueprint $table ): void {
			$table->index( [ 'active', 'published_at' ], 'privacy_policies_active_published_idx' );
		} );

		Schema::table( 'privacy_data_request_logs', function ( Blueprint $table ): void {
			$table->index( 'data_request_id', 'privacy_data_request_logs_request_idx' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::table( 'privacy_data_request_logs', function ( Blueprint $table ): void {
			$table->dropIndex( 'privacy_data_request_logs_request_idx' );
		} );

		Schema::table( 'privacy_policies', function ( Blueprint $table ): void {
			$table->dropIndex( 'privacy_policies_active_published_idx' );
		} );

		Schema::table( 'privacy_data_requests', function ( Blueprint $table ): void {
			$table->dropUnique( 'privacy_data_requests_token_unique' );
			$table->dropUnique( 'privacy_data_requests_token_hash_unique' );
			$table->dropColumn( 'verification_token_hash' );
		} );
	}
};
