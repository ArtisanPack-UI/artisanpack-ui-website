<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\DashboardFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $slug
 * @property bool $is_default
 * @property int $position
 * @property array<int, array<string, mixed>> $widgets
 * @property \Illuminate\Support\Carbon $created_at
 * @property \Illuminate\Support\Carbon $updated_at
 */
class Dashboard extends Model
{
    /** @use HasFactory<DashboardFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'is_default',
        'position',
        'widgets',
    ];

    /**
     * The user that owns this dashboard.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'widgets'    => 'array',
        ];
    }
}
