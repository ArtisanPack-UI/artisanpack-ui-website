<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use ArtisanPackUI\Forms\Models\Form;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public form rendering.
 *
 * Backs `/forms/{form}` for showing a single form on its own page. The
 * actual rendering, validation, and submission are owned by the
 * artisanpack-ui/forms React `FormRenderer`, which talks to the
 * package's `/api/v1/forms/{form}/render` and `/submit` endpoints.
 */
class PublicFormController extends Controller
{
    public function show(Form $form): Response
    {
        abort_unless($form->is_active, 404);

        return Inertia::render('PublicForm', [
            'form' => [
                'id'   => $form->id,
                'slug' => $form->slug,
                'name' => $form->name,
            ],
        ]);
    }
}
