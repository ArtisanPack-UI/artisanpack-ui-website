<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\PermalinkStructure;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Comment;
use ArtisanPackUI\CMSFramework\Modules\Blog\Models\Post;
use ArtisanPackUI\CMSFramework\Modules\ContentTypes\Enums\ContentStatus;
use ArtisanPackUI\CMSFramework\Modules\Settings\Managers\SettingsManager;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Handles HTML form submissions from the visual-editor's
 * `artisanpack/post-comments-form` block.
 *
 * The block renderer points its `<form action>` at this controller
 * (via the `comments.form.action` hooks filter wired in
 * `AppServiceProvider`). The cms-framework `/api/v1/comments` endpoint
 * returns 201 + JSON, which is correct for SPAs but breaks the
 * standard browser-form UX where the user expects to land back on the
 * post with a flash message. This controller does the redirect-back
 * + flash that the API endpoint can't provide on its own.
 *
 * Validation + capability gating mirror cms-framework's `CommentRequest`
 * / `CommentPolicy`: client-supplied `user_id` is ignored, the form
 * throttle is applied at the route layer (`throttle:comments`), and the
 * six `discussion.*` settings (#68) gate every anti-spam / moderation
 * decision this controller makes.
 */
class CommentSubmissionController extends Controller
{
    public function __construct(
        private readonly PermalinkStructure $permalinks,
        private readonly SettingsManager $settings,
    ) {}

    public function store(Request $request): RedirectResponse
    {
        if (! (bool) $this->settings->getSetting('discussion.comments')) {
            return back()->with('comment_error', 'Comments are closed.');
        }

        $data = $request->validate([
            'post_id'      => ['required', 'integer', 'exists:posts,id'],
            // `parent_id` is validated to be in the comments table here,
            // but the per-post scope check happens after we've loaded
            // `$post` below — Laravel's `exists:` rule can't reference
            // another field's value through the rule string without
            // a Rule::exists() closure, and we'd rather reject with a
            // friendly flash message than a generic 422 anyway.
            'parent_id'    => ['nullable', 'integer', 'exists:post_comments,id'],
            'author_name'  => ['nullable', 'string', 'max:255'],
            'author_email' => ['nullable', 'email', 'max:255'],
            'author_url'   => ['nullable', 'url', 'max:2048'],
            'content'      => ['required', 'string', 'min:1', 'max:65535'],
        ]);

        // Mirror the published-post visibility used by BlogController::show()
        // and PermalinkStructure::resolve(): a post is publicly visible only
        // when its `status` is Published AND its `published_at` is in the
        // past (not null, not a future scheduled timestamp). Without these
        // guards a scheduled or drafted post that happens to carry the
        // submitted id would still accept new comments through this route.
        $post = Post::query()
            ->where('id', (int) $data['post_id'])
            ->where('status', ContentStatus::Published)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->first();

        if (null === $post) {
            return back()->with('comment_error', 'That post is no longer accepting comments.');
        }

        $user = $request->user();

        if ((bool) $this->settings->getSetting('discussion.requireRegistration') && null === $user) {
            return back()->with('comment_error', 'You must be signed in to comment.');
        }

        // CAPTCHA gate. Keystone does not ship a CAPTCHA provider, so
        // this call is a filter hook a future provider (Turnstile /
        // hCaptcha / reCAPTCHA plugin) attaches to via
        // `addFilter('comments.captcha.verify', ...)`. The default is
        // `true` (accept), which means the toggle is a no-op until a
        // provider registers — flipping it on today does not lock the
        // form. Documented on the tracking issue.
        if ((bool) $this->settings->getSetting('discussion.captcha') && function_exists('applyFilters')) {
            $verified = (bool) applyFilters('comments.captcha.verify', true, $request);

            if (! $verified) {
                return back()->with('comment_error', 'CAPTCHA verification failed. Please try again.');
            }
        }

        // Cross-post reply protection: a client can submit `post_id` for
        // post A and `parent_id` from post B, which would create a reply
        // chain that spans posts and breaks the thread tree. Load the
        // parent against `$post->id` before persisting; reject with a
        // friendly flash if the parent doesn't belong to this post.
        $parentId = null;
        if (! empty($data['parent_id'])) {
            $parent = Comment::query()
                ->whereKey((int) $data['parent_id'])
                ->where('post_id', $post->id)
                ->first();

            if (null === $parent) {
                return back()->with('comment_error', 'That comment thread is no longer available.');
            }

            $parentId = $parent->id;
        }

        // Link-count gate. Zero = no limit (matches the WordPress
        // convention the admin UI copies). Count is generous — any URL
        // shape a moderator would recognize as a link — because the
        // consequence of a false positive is only a friendly bounce.
        $linkLimit = (int) $this->settings->getSetting('discussion.limitLinks');
        if ($linkLimit > 0 && self::countLinks($data['content']) > $linkLimit) {
            return back()->with('comment_error', 'That comment has too many links.');
        }

        // Banned-words match against every visitor-controlled field.
        // A match routes the comment to `spam` so an admin can review
        // (matching WordPress' Comment Blocklist behavior) rather than
        // silently rejecting — false positives are recoverable that
        // way. The check runs before the approval mode is applied so
        // banned matches always win over `automatically-approved`.
        $bannedMatch = self::matchesBannedWords(
            (string) $this->settings->getSetting('discussion.bannedWords'),
            [
                $data['content'],
                $data['author_name'] ?? '',
                $data['author_email'] ?? '',
                $data['author_url'] ?? '',
            ],
        );

        $canModerate   = null !== $user && $user->can('comments.moderate');
        $defaultStatus = $this->resolveDefaultStatus(
            $canModerate,
            $bannedMatch,
            (string) $this->settings->getSetting('discussion.commentsApproval'),
            $user,
            $data['author_email'] ?? null,
        );

        // Match the cms-framework controller's filter so host apps
        // (e.g. local-env auto-approve, production spam pre-flight)
        // get a single override point regardless of which controller
        // is doing the persist.
        $status = function_exists('applyFilters')
            ? (string) applyFilters('comments.store.defaultStatus', $defaultStatus, $request)
            : $defaultStatus;

        // A banned-words match must never be silently upgraded by a
        // filter that fires `approved` by default (e.g. the local-env
        // auto-approve filter in AppServiceProvider). Spam always wins.
        if ($bannedMatch) {
            $status = Comment::STATUS_SPAM;
        }

        Comment::create([
            'post_id'      => $post->id,
            'parent_id'    => $parentId,
            'user_id'      => $user?->getAuthIdentifier(),
            'author_name'  => $data['author_name'] ?? null,
            'author_email' => $data['author_email'] ?? null,
            'author_url'   => $data['author_url'] ?? null,
            'content'      => $data['content'],
            'status'       => $status,
            'approved_at'  => Comment::STATUS_APPROVED === $status ? now() : null,
        ]);

        $message = Comment::STATUS_APPROVED === $status
            ? 'Comment posted.'
            : 'Thanks — your comment is awaiting moderation.';

        return redirect($this->permalinks->build($post).'#comments')
            ->with('comment_success', $message);
    }

    /**
     * Pick the default status for this submission based on the
     * `discussion.commentsApproval` mode. Moderators always land on
     * `approved`; a banned-words match always lands on `spam`. Everyone
     * else falls through the mode:
     *
     * - `automatically-approved` → `approved`
     * - `previously-approved`    → `approved` if this author has a
     *                              prior approved comment (matched by
     *                              user_id when authenticated, else by
     *                              `author_email`); otherwise `pending`
     * - `manually-approved`      → `pending` (default)
     */
    private function resolveDefaultStatus(
        bool $canModerate,
        bool $bannedMatch,
        string $approvalMode,
        ?Authenticatable $user,
        ?string $authorEmail,
    ): string {
        if ($canModerate) {
            return Comment::STATUS_APPROVED;
        }

        if ($bannedMatch) {
            return Comment::STATUS_SPAM;
        }

        return match ($approvalMode) {
            'automatically-approved' => Comment::STATUS_APPROVED,
            'previously-approved'    => self::hasPriorApprovedComment($user, $authorEmail)
                ? Comment::STATUS_APPROVED
                : Comment::STATUS_PENDING,
            default => Comment::STATUS_PENDING,
        };
    }

    /**
     * `previously-approved` lookup. Prefer `user_id` when the visitor
     * is authenticated — it's the strongest identity signal we have —
     * and fall back to `author_email` for guests. A blank email on a
     * guest submission returns `false` so a null email doesn't grant
     * approval to every guest who omits the field.
     */
    private static function hasPriorApprovedComment(?Authenticatable $user, ?string $authorEmail): bool
    {
        if (null !== $user) {
            return Comment::query()
                ->where('user_id', $user->getAuthIdentifier())
                ->where('status', Comment::STATUS_APPROVED)
                ->exists();
        }

        $email = trim((string) $authorEmail);

        if ('' === $email) {
            return false;
        }

        return Comment::query()
            ->where('author_email', $email)
            ->where('status', Comment::STATUS_APPROVED)
            ->exists();
    }

    /**
     * Count URL-shaped tokens in a comment body. Matches bare-scheme
     * (`http://…`, `https://…`), protocol-relative (`//example.com`),
     * and `www.`-prefixed hosts — the shapes visitors typically paste.
     * Deliberately loose: false positives cost the visitor a friendly
     * bounce, false negatives let link-spam through.
     */
    private static function countLinks(string $content): int
    {
        $matches = preg_match_all('~(?:https?://|www\.|//)[^\s<>"]+~i', $content, $unused);

        return false === $matches ? 0 : $matches;
    }

    /**
     * Case-insensitive whole/partial-word match. The banned-words list
     * is admin-authored free text — split on newlines *and* commas so
     * either format works — and matched as a substring against each
     * haystack (comment body, author name/email/url). Any single hit
     * flips the comment to spam.
     */
    private static function matchesBannedWords(string $rawList, array $haystacks): bool
    {
        $rawList = trim($rawList);

        if ('' === $rawList) {
            return false;
        }

        $terms = preg_split('/[\r\n,]+/', $rawList) ?: [];
        $terms = array_values(array_filter(array_map('trim', $terms), static fn (string $t): bool => '' !== $t));

        if ([] === $terms) {
            return false;
        }

        $haystack = mb_strtolower(implode(' ', array_map('strval', $haystacks)));

        foreach ($terms as $term) {
            if (str_contains($haystack, mb_strtolower($term))) {
                return true;
            }
        }

        return false;
    }
}
