<?php

declare(strict_types=1);

namespace Modules\Forms\Http\Controllers;

use App\Http\Controllers\Controller;
use ArtisanPackUI\Forms\Models\Form;
use ArtisanPackUI\Forms\Models\FormSubmission;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin-side Forms management.
 *
 * Backs `/admin/forms` against the artisanpack-ui/forms package. The list
 * page renders real Form/FormSubmission data; the create flow auto-drafts
 * a form (subject to the `keystone.limits.max_forms` cap) and lands the
 * user in the React builder mounted from the package. Submissions list
 * and detail views consume the package's React components.
 */
class FormController extends Controller
{
    public function index(): Response
    {
        $forms = Form::query()
            ->withCount(['submissions as submissions_count'])
            ->withCount(['submissions as unread_count' => function ($query): void {
                $query->where('is_read', false)->where('is_spam', false);
            }])
            // `withMax` aliases `MAX(created_at)` from submissions into a
            // single subquery so {@see rowPayload} can read the timestamp
            // off the loaded Form instead of issuing a per-row "latest
            // submission" lookup — the original implementation was an
            // N+1 once the list grew beyond a handful of forms.
            ->withMax('submissions as last_submission_at', 'created_at')
            ->latest('updated_at')
            ->get();

        $recentLeads = FormSubmission::query()
            ->with('form:id,name')
            ->where('is_spam', false)
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (FormSubmission $submission): array => $this->leadPayload($submission))
            ->all();

        return Inertia::render('admin/Forms', [
            'forms'        => $forms->map(fn (Form $form): array => $this->rowPayload($form))->all(),
            'recent_leads' => $recentLeads,
            'limit'        => [
                'max'     => config('keystone.limits.max_forms'),
                'current' => $forms->count(),
            ],
        ]);
    }

    /**
     * Create a form from the "New form" modal. The user supplies a name;
     * the slug is derived from it by the package's `Form::creating` boot
     * hook so the user doesn't have to manage two coupled fields. The
     * `max_forms` cap still applies.
     */
    public function create(Request $request): RedirectResponse
    {
        if ($this->limitReached()) {
            return redirect()
                ->route('admin.forms.index')
                ->with('error', $this->limitMessage());
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $form = Form::create([
            'name'               => $validated['name'],
            // Intentionally omit `slug` so the package's boot hook derives
            // a unique slug from the name; otherwise the user would have
            // to manually keep two fields in sync.
            'user_id'            => $request->user()?->id,
            'submit_button_text' => 'Submit',
            'is_active'          => false,
        ]);

        return redirect()->route('admin.forms.edit', $form->id);
    }

    public function edit(Form $form): Response
    {
        return Inertia::render('admin/forms/Edit', [
            'form' => $this->formPayload($form),
        ]);
    }

    public function destroy(Form $form): RedirectResponse
    {
        $form->delete();

        return redirect()
            ->route('admin.forms.index')
            ->with('success', 'Form deleted.');
    }

    public function submissions(?Form $form = null): Response
    {
        if ($form?->exists) {
            return Inertia::render('admin/forms/Submissions', [
                'form'      => $this->formPayload($form),
                'all_forms' => null,
            ]);
        }

        // No specific form passed — render the inbox picker with all forms
        // and their counts so the user can drill down per-form.
        $forms = Form::query()
            ->withCount(['submissions as submissions_count'])
            ->withCount(['submissions as unread_count' => function ($query): void {
                $query->where('is_read', false)->where('is_spam', false);
            }])
            ->orderBy('name')
            ->get();

        return Inertia::render('admin/forms/Submissions', [
            'form'      => null,
            'all_forms' => $forms->map(fn (Form $f): array => [
                'id'          => $f->id,
                'slug'        => $f->slug,
                'name'        => $f->name,
                'submissions' => (int) ($f->submissions_count ?? 0),
                'unread'      => (int) ($f->unread_count ?? 0),
            ])->all(),
        ]);
    }

    public function submissionShow(Form $form, FormSubmission $submission): Response
    {
        abort_unless($submission->form_id === $form->id, 404);

        return Inertia::render('admin/forms/SubmissionDetail', [
            'form'          => $this->formPayload($form),
            'submission_id' => $submission->id,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function formPayload(Form $form): array
    {
        return [
            'id'                    => $form->id,
            'name'                  => $form->name,
            'slug'                  => $form->slug,
            'description'           => $form->description,
            'submit_button_text'    => $form->submit_button_text,
            'success_message'       => $form->success_message,
            'redirect_url'          => $form->redirect_url,
            'is_multi_step'         => (bool) $form->is_multi_step,
            'show_progress_bar'     => (bool) $form->show_progress_bar,
            'allow_step_navigation' => (bool) $form->allow_step_navigation,
            'is_active'             => (bool) $form->is_active,
            'created_at'            => optional($form->created_at)->toISOString(),
            'updated_at'            => optional($form->updated_at)->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function rowPayload(Form $form): array
    {
        $lastSubmission = $form->getAttribute('last_submission_at');

        return [
            'id'              => $form->id,
            'name'            => $form->name,
            'slug'            => $form->slug,
            'status'          => $form->is_active ? 'active' : 'draft',
            'submissions'     => (int) ($form->submissions_count ?? 0),
            'unread'          => (int) ($form->unread_count ?? 0),
            'conversion'      => 0,
            // Reads the aliased aggregate from {@see index} rather than
            // issuing a per-row submission query. `withMax` hands back
            // either a string (MySQL datetime) or a Carbon (depending
            // on column casts on the package's Submission model), so
            // we normalize via Carbon::parse before serializing.
            'last_submission' => null !== $lastSubmission
                ? Carbon::parse((string) $lastSubmission)->toISOString()
                : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function leadPayload(FormSubmission $submission): array
    {
        $email = $submission->getEmailValue();
        $name  = $submission->getValue('name')
            ?? $submission->getValue('full_name')
            ?? $submission->getValue('first_name')
            ?? ($email ?? 'Anonymous');

        return [
            'id'          => $submission->id,
            'name'        => $name,
            'email'       => $email ?? '',
            'form'        => $submission->form?->name ?? '—',
            'status'      => $submission->is_read ? 'contacted' : 'new',
            'received_at' => optional($submission->created_at)->toISOString(),
        ];
    }

    private function limitReached(): bool
    {
        $max = config('keystone.limits.max_forms');

        return is_int($max) && Form::query()->count() >= $max;
    }

    private function limitMessage(): string
    {
        $max = (int) config('keystone.limits.max_forms');

        return "You've reached the {$max}-form limit for this plan. Delete an existing form or upgrade to add more.";
    }
}
