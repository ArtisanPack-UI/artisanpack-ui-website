import { useEffect, useRef } from 'react';

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
        };
    }, [active]);

    return containerRef;
}
