import '../css/keystone-form-island.css';

import { createRoot } from 'react-dom/client';
import { FormRenderer } from './vendor/artisanpack-forms/react/components/FormRenderer';

/**
 * Mounts a forms-package <FormRenderer /> into any element on the page
 * carrying `data-keystone-form="<form-slug>"`. Lets theme Blade templates
 * embed a form inline without requiring the visitor-side bundle to be
 * loaded by Inertia.
 *
 * Usage from a Blade view:
 *
 *     <x-keystone-form form-slug="contact" />
 */
function mountAll() {
    document
        .querySelectorAll<HTMLElement>('[data-keystone-form]:not([data-keystone-form-mounted])')
        .forEach((el) => {
            const slug = el.dataset.keystoneForm;
            if (!slug) {
                return;
            }
            el.dataset.keystoneFormMounted = 'true';
            createRoot(el).render(
                <FormRenderer baseUrl="/api/v1/forms" formSlug={slug} />,
            );
        });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
} else {
    mountAll();
}
