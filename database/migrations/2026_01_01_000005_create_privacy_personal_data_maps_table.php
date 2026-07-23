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
		Schema::create( 'privacy_personal_data_maps', function ( Blueprint $table ): void {
			$table->id();
			$table->string( 'model' );
			$table->string( 'field' );
			$table->string( 'data_type' );
			$table->string( 'sensitivity' )->default( 'normal' );
			$table->string( 'retention_period' )->nullable();
			$table->string( 'deletion_strategy' );
			$table->string( 'export_format' )->nullable();
			$table->boolean( 'auto_discovered' )->default( false );
			$table->timestamps();

			$table->unique( [ 'model', 'field' ] );
			$table->index( 'data_type' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_personal_data_maps' );
	}
};
