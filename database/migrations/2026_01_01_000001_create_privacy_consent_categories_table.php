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
		Schema::create( 'privacy_consent_categories', function ( Blueprint $table ): void {
			$table->id();
			$table->string( 'key' )->unique();
			$table->string( 'name' );
			$table->text( 'description' )->nullable();
			$table->boolean( 'required' )->default( false );
			$table->integer( 'sort_order' )->default( 0 );
			$table->boolean( 'active' )->default( true );
			$table->json( 'regulations' )->nullable();
			$table->timestamps();

			$table->index( 'active' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_consent_categories' );
	}
};
