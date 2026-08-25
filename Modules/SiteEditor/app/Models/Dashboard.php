<?php

declare(strict_types=1);

namespace Modules\SiteEditor\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\SiteEditor\Database\Factories\DashboardFactory;
use Modules\Users\Models\User;

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
     *
     * The import is new with the move: the class used to sit in `App\Models`
     * and resolved `User::class` off its own namespace, which stopped
     * pointing at anything real when the Users module took the model (#208).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Resolve the module-namespaced factory.
     *
     * `HasFactory` guesses `Database\Factories\{Model}Factory`, which is the
     * central namespace this model no longer lives under
     * (plans/14-modular-laravel-setup.md §3.6).
     */
    protected static function newFactory(): DashboardFactory
    {
        return DashboardFactory::new();
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
