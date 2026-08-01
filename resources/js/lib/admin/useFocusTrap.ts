import { useEffect, useRef } from 'react';
import { doAction } from '@artisanpack-ui/hooks-js';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Trap keyboard focus inside the returned container ref while $active is
 * true. On activation, focus moves to the first focusable child (or the
 * container itself); Tab / Shift+Tab wrap within the container; on
 * deactivation, focus restores to whatever element was focused beforehand.
 *
 * Pair with `aria-modal="true"` + an Escape handler to give modal dialogs
 * the keyboard behavior screen-reader and keyboard users expect.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
    const containerRef = useRef<T | null>(null);

    useEffect(() => {
        if (!active) {
            return;
        }

        const container = containerRef.current;
        if (!container) {
            return;
        }

        const previouslyFocused = document.activeElement as HTMLElement | null;

        const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        const first = focusables[0] ?? container;
        first.focus();

        // Fire `keystone.admin.focusTrap.mounted` so a plugin can react
        // to the trap taking effect (analytics on modal open, custom
        // focus placement, an aria-live announcement). Args:
        // `(HTMLElement, { previouslyFocused, focusableCount })`.
        // Only fires on activation — no `.unmounted` twin because the
        // useEffect's cleanup fires deterministically on deactivation
        // and subscribers can pair the two via the mounted-side ref.
        doAction('keystone.admin.focusTrap.mounted', container, {
            previouslyFocused,
            focusableCount: focusables.length,
        });

        // Every Keystone modal uses `useFocusTrap` today, so use it as
        // the canonical hook for `.modal.opened` / `.modal.closed` as
        // well. Subscribers get the same container reference on both
        // sides so a `WeakMap<HTMLElement, Session>` in the plugin
        // pairs open/close deterministically. A future drawer or
        // popover that opts out of `useFocusTrap` will need to fire
        // these itself. Args: `(HTMLElement)`.
        doAction('keystone.admin.modal.opened', container);

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== 'Tab') {
                return;
            }
            const current = container!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
            if (current.length === 0) {
                event.preventDefault();
                return;
            }
            const firstEl = current[0];
            const lastEl = current[current.length - 1];
            const target = document.activeElement as HTMLElement | null;

            if (event.shiftKey && target === firstEl) {
                event.preventDefault();
                lastEl.focus();
            } else if (!event.shiftKey && target === lastEl) {
                event.preventDefault();
                firstEl.focus();
            }
        }

        container.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
            doAction('keystone.admin.modal.closed', container);
        };
    }, [active]);

    return containerRef;
}
