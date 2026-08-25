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
		Schema::create( 'privacy_policies', function ( Blueprint $table ): void {
			$table->id();
			$table->string( 'version' );
			$table->string( 'regulation' )->nullable();
			$table->string( 'locale', 10 )->default( 'en' );
			$table->text( 'content' );
			$table->json( 'sections' )->nullable();
			$table->boolean( 'active' )->default( false );
			$table->boolean( 'requires_reconsent' )->default( false );
			$table->timestamp( 'published_at' )->nullable();
			$table->unsignedBigInteger( 'created_by' )->nullable();
			$table->timestamps();

			$table->index( [ 'active', 'regulation', 'locale' ] );
			$table->index( 'version' );
		} );
	}

	/**
	 * Reverse the migrations.
	 */
	public function down(): void
	{
		Schema::dropIfExists( 'privacy_policies' );
	}
};
