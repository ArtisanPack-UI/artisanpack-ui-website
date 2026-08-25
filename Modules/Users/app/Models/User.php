<?php

declare(strict_types=1);

namespace Modules\Users\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use ArtisanPackUI\CMSFramework\Modules\Notifications\Models\Concerns\HasNotifications;
use ArtisanPackUI\CMSFramework\Modules\Users\Models\Concerns\HasRolesAndPermissions;
use ArtisanPackUI\MediaLibrary\Models\Media;
use ArtisanPackUI\Privacy\Concerns\HasPersonalData;
use ArtisanPackUI\SecurityAuth\TwoFactor\TwoFactorAuthenticatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Modules\SiteEditor\Models\Dashboard;
use Modules\Users\Database\Factories\UserFactory;

/**
 * @property int $id
 * @property string|null $first_name
 * @property string|null $last_name
 * @property string $username
 * @property string|null $nickname
 * @property string $display_name
 * @property int|null $profile_photo_id
 * @property string $email
 * @property \Illuminate\Support\Carbon|null $email_verified_at
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory;

    use HasNotifications;
    use HasPersonalData;
    use HasRolesAndPermissions;
    use Notifiable;
    use TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'username',
        'nickname',
        'display_name',
        'profile_photo_id',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Field descriptors consumed by the artisanpack-ui/privacy package's
     * export, scan, and anonymization services. Only the columns that
     * genuinely carry personal data appear here — role assignments,
     * dashboards, and other operational relations are managed outside the
     * DSR envelope. `deletion_strategy` keys drive AnonymizationService
     * behaviour when a subject requests deletion.
     *
     * @return array<string, array<string, string>>
     */
    public function personalDataFields(): array
    {
        return [
            'first_name' => [
                'type'              => 'name',
                'sensitivity'       => 'normal',
                'deletion_strategy' => 'pseudonymize',
            ],
            'last_name' => [
                'type'              => 'name',
                'sensitivity'       => 'normal',
                'deletion_strategy' => 'pseudonymize',
            ],
            'nickname' => [
                'type'              => 'name',
                'sensitivity'       => 'normal',
                'deletion_strategy' => 'pseudonymize',
            ],
            'display_name' => [
                'type'              => 'name',
                'sensitivity'       => 'normal',
                'deletion_strategy' => 'pseudonymize',
            ],
            'username' => [
                'type'              => 'name',
                'sensitivity'       => 'normal',
                'deletion_strategy' => 'pseudonymize',
            ],
            'email' => [
                'type'              => 'email',
                'sensitivity'       => 'normal',
                'deletion_strategy' => 'mask',
            ],
        ];
    }

    /**
     * The profile photo for the user.
     *
     * Mirrors the `featured_image_id` foreign-key pattern used by Post and
     * Page on the `media` table — set/clear by writing `profile_photo_id`.
     * Falls back to the initials avatar in the UI when null.
     */
    public function profilePhoto(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'profile_photo_id');
    }

    /**
     * The customizable admin dashboards this user owns. Ordered by `position`
     * so the dashboard switcher in the admin UI iterates them in the order the
     * user dragged them.
     */
    public function dashboards(): HasMany
    {
        return $this->hasMany(Dashboard::class)->orderBy('position');
    }

    /**
     * Get the user's initials, derived from `display_name`. Returns the first
     * character of up to the first two words, so "Jacob Martella" → "JM" and
     * "jdoe" → "J".
     */
    public function initials(): string
    {
        return Str::of($this->display_name ?? '')
            ->explode(' ')
            ->take(2)
            ->map(fn ($word) => Str::substr($word, 0, 1))
            ->implode('');
    }

    /**
     * The non-empty WordPress-style display-name candidates derived from the
     * user's identity fields. Used to populate the "Display name publicly as"
     * dropdown on the admin Edit and Profile Settings pages.
     *
     * Order: username, first name, last name, "First Last", "Last First",
     * nickname — duplicates removed while preserving first-seen order.
     *
     * @return list<string>
     */
    public function displayNameCandidates(): array
    {
        $first    = trim((string) $this->first_name);
        $last     = trim((string) $this->last_name);
        $nickname = trim((string) $this->nickname);
        $username = trim((string) $this->username);

        $candidates = [
            $username,
            $first,
            $last,
            '' !== $first && '' !== $last ? $first.' '.$last : '',
            '' !== $first && '' !== $last ? $last.' '.$first : '',
            $nickname,
        ];

        return array_values(array_unique(array_filter($candidates, fn (string $value) => '' !== $value)));
    }

    /**
     * Adapter accessor: surface `display_name` as `$user->name` so the
     * visual-editor `PostResolver::resolveAuthor()` (and the matching
     * `WpEntityResource._preview.author.name` envelope) pick up the
     * keystone user's display name when rendering `post-author*` /
     * `avatar` blocks. Falls back to an empty string so the resolver's
     * `(string)` cast stays well-defined when `display_name` is null.
     */
    public function getNameAttribute(): string
    {
        return (string) ($this->attributes['display_name'] ?? '');
    }

    /**
     * Adapter accessor: surface the user's profile-photo URL as
     * `$user->avatar_url` so the visual-editor `PostResolver` stamps
     * the keystone avatar onto the `avatar` and (deprecated)
     * `post-author` blocks. Returns an empty string when no profile
     * photo is set — the editor preview and front-end renderer treat
     * an empty URL as "no avatar" and skip the `<img>` element.
     */
    public function getAvatarUrlAttribute(): string
    {
        $photo = $this->profilePhoto;

        if (null === $photo) {
            return '';
        }

        return $photo->url();
    }

    /**
     * Resolve the model's factory explicitly.
     *
     * Laravel's default resolver maps `App\Models\X` to
     * `Database\Factories\XFactory`; a model namespaced into a module
     * matches neither half of that guess, so every `User::factory()` call
     * — which is most of the suite — would fail without this override.
     */
    protected static function newFactory(): UserFactory
    {
        return UserFactory::new();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
        ];
    }
}
