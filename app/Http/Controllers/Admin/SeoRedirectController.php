<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Support\Hooks;
use ArtisanPackUI\SEO\Models\Redirect;
use ArtisanPackUI\SEO\Services\RedirectService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-side CRUD for SEO redirects.
 *
 * The artisanpack-ui/seo package's `HandleRedirects` middleware reads the
 * `redirects` table on every web request; this controller is the admin
 * surface to author them. Each successful mutation calls the SEO
 * package's `CacheService` so the in-memory redirect cache is rebuilt
 * before the next match attempt.
 *
 * Route binding uses the auto-resolved `Redirect $redirect` parameter on
 * the resource routes, so admins can hit `/admin/seo/redirects/{id}` to
 * edit without us having to thread the model through every action.
 */
class SeoRedirectController extends Controller
{
    public function __construct(private readonly RedirectService $redirectService) {}

    public function index(): Response
    {
        $redirects = Redirect::query()
            ->orderByDesc('updated_at')
            ->get([
                'id',
                'from_path',
                'to_path',
                'status_code',
                'match_type',
                'is_active',
                'hits',
                'last_hit_at',
                'notes',
                'updated_at',
            ]);

        return Inertia::render('admin/seo/Redirects', [
            'redirects' => $redirects->map(fn (Redirect $redirect) => $this->rowPayload($redirect))->all(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->normalizeFromPathOnRequest($request);
        $validated = $request->validate($this->rules());

        $created = Redirect::create([
            'from_path'   => $validated['from_path'],
            'to_path'     => $validated['to_path'],
            'status_code' => (int) $validated['status_code'],
            'match_type'  => $validated['match_type'],
            'is_active'   => (bool) ($validated['is_active'] ?? true),
            'notes'       => $validated['notes'] ?? null,
        ]);

        $this->redirectService->clearCache();

        $this->fireSaved([
            'action' => 'created',
            'id'     => (int) $created->id,
            'to'     => $created->only(['from_path', 'to_path', 'status_code', 'match_type', 'is_active', 'notes']),
        ]);

        Hooks::safeDoAction('keystone.admin.seo.redirect.created', $created);

        return redirect()
            ->route('admin.seo.redirects.index')
            ->with('success', 'Redirect created.');
    }

    public function update(Request $request, Redirect $redirect): RedirectResponse
    {
        $this->normalizeFromPathOnRequest($request);
        $validated = $request->validate($this->rules($redirect));

        $previous = $redirect->only(['from_path', 'to_path', 'status_code', 'match_type', 'is_active', 'notes']);

        $redirect->update([
            'from_path'   => $validated['from_path'],
            'to_path'     => $validated['to_path'],
            'status_code' => (int) $validated['status_code'],
            'match_type'  => $validated['match_type'],
            // Match store(): missing flag means "leave it active". The React
            // form always sends the boolean, so this default only matters
            // for API consumers that omit it.
            'is_active'   => (bool) ($validated['is_active'] ?? true),
            'notes'       => $validated['notes'] ?? null,
        ]);

        $this->redirectService->clearCache();

        $this->fireSaved([
            'action' => 'updated',
            'id'     => (int) $redirect->id,
            'from'   => $previous,
            'to'     => $redirect->only(['from_path', 'to_path', 'status_code', 'match_type', 'is_active', 'notes']),
        ]);

        Hooks::safeDoAction('keystone.admin.seo.redirect.updated', $redirect, $previous);

        return redirect()
            ->route('admin.seo.redirects.index')
            ->with('success', 'Redirect updated.');
    }

    public function destroy(Redirect $redirect): RedirectResponse
    {
        $snapshot = $redirect->only(['from_path', 'to_path', 'status_code', 'match_type', 'is_active', 'notes']);
        $id       = (int) $redirect->id;

        $redirect->delete();
        $this->redirectService->clearCache();

        $this->fireSaved([
            'action' => 'deleted',
            'id'     => $id,
            'from'   => $snapshot,
        ]);

        Hooks::safeDoAction('keystone.admin.seo.redirect.deleted', $id, $snapshot);

        return redirect()
            ->route('admin.seo.redirects.index')
            ->with('success', 'Redirect deleted.');
    }

    /**
     * SEO redirects are a small table where every mutation is essentially
     * a "settings save" from a subscriber's POV (cache invalidation,
     * audit log, sitemap resync). Fire both the per-panel and generic
     * hooks so plugin authors can subscribe at either granularity.
     *
     * @param  array{
     *     action: 'created'|'deleted'|'updated',
     *     id: int,
     *     from?: array<string, bool|int|string|null>,
     *     to?: array<string, bool|int|string|null>
     * }  $diff
     */
    protected function fireSaved(array $diff): void
    {
        $payload = ['panel' => 'seoRedirects', 'diff' => $diff];
        Hooks::safeDoAction('keystone.admin.settings.seoRedirects.saved', $payload);
        Hooks::safeDoAction('keystone.admin.settings.saved', $payload);
    }

    /**
     * Validation rules for create + update. Pass the existing redirect on
     * update so the unique check ignores it.
     *
     * @return array<string, array<int, \Illuminate\Validation\Rules\Unique|string>>
     */
    protected function rules(?Redirect $ignore = null): array
    {
        $unique = Rule::unique('redirects', 'from_path');

        if (null !== $ignore) {
            $unique = $unique->ignore($ignore->id);
        }

        return [
            'from_path'   => ['required', 'string', 'max:500', $unique],
            'to_path'     => ['required', 'string', 'max:500'],
            'status_code' => ['required', Rule::in(Redirect::VALID_STATUS_CODES)],
            'match_type'  => ['required', Rule::in(Redirect::VALID_MATCH_TYPES)],
            'is_active'   => ['nullable', 'boolean'],
            'notes'       => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Replace the request's `from_path` with its normalized form before
     * validation runs. This is what makes the uniqueness check accurate:
     * if we normalized after validating, `about` and `/about` would each
     * pass the unique check separately and then collide at write time.
     * Regex patterns are skipped entirely so `^/old/(.+)$` doesn't get
     * prefixed with another `/`.
     */
    protected function normalizeFromPathOnRequest(Request $request): void
    {
        $matchType = (string) $request->input('match_type', Redirect::MATCH_EXACT);
        $request->merge([
            'from_path' => $this->normalizePath(
                (string) $request->input('from_path', ''),
                $matchType,
            ),
        ]);
    }

    /**
     * Normalize the incoming `from_path` to a consistent shape so an
     * admin entering `about` vs `/about` ends up with the same row. Only
     * applies to non-regex matches; regex patterns are left intact so
     * the pattern delimiters / anchors aren't corrupted. Blank input is
     * passed through unchanged so the `required` validator can catch it
     * — converting it to `/` here would silently let through root
     * redirects no one asked for.
     */
    protected function normalizePath(string $path, string $matchType = Redirect::MATCH_EXACT): string
    {
        $path = trim($path);

        if ('' === $path) {
            return '';
        }

        if (Redirect::MATCH_REGEX === $matchType) {
            return $path;
        }

        // Skip normalization for full URLs so external redirects work.
        if (1 === preg_match('#^https?://#i', $path)) {
            return $path;
        }

        return '/'.ltrim($path, '/');
    }

    /**
     * Shape a redirect for the React table.
     *
     * @return array{id: int, from_path: string, to_path: string, status_code: int, match_type: string, is_active: bool, hits: int, last_hit_at: string|null, notes: string|null, updated_at: string|null}
     */
    protected function rowPayload(Redirect $redirect): array
    {
        return [
            'id'          => (int) $redirect->id,
            'from_path'   => (string) $redirect->from_path,
            'to_path'     => (string) $redirect->to_path,
            'status_code' => (int) $redirect->status_code,
            'match_type'  => (string) $redirect->match_type,
            'is_active'   => (bool) $redirect->is_active,
            'hits'        => (int) $redirect->hits,
            'last_hit_at' => optional($redirect->last_hit_at)->toISOString(),
            'notes'       => $redirect->notes,
            'updated_at'  => optional($redirect->updated_at)->toISOString(),
        ];
    }
}
