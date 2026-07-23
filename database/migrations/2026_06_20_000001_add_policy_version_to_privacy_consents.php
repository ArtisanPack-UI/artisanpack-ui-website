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
		Schema::table( 'privacy_consents', function ( Blueprint $table ): void {
			$table->string( 'policy_version', 64 )->nullable()->after( 'regulation' );
			$table->index( 'policy_version', 'privacy_consents_policy_version_idx' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::table( 'privacy_consents', function ( Blueprint $table ): void {
			$table->dropIndex( 'privacy_consents_policy_version_idx' );
			$table->dropColumn( 'policy_version' );
		} );
	}
};
