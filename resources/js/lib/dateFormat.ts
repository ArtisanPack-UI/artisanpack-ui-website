import { usePage } from '@inertiajs/react';
import { formatPhpDate } from '@/lib/admin/phpDateFormat';
import type { KeystoneSharedProps } from '@/types/keystone';

/**
 * Client-side date/time formatter that mirrors the server's
 * {@link formatPhpDate} contract: it reads the same stored PHP `date()` format
 * strings (shared via Inertia as `keystone.formats`) so a date rendered on the
 * client matches what the API/SSR would produce.
 *
 * Returned helpers accept ISO strings (the wire format every controller uses)
 * and return formatted display strings, converting the instant into the
 * configured site timezone first.
 */
export interface DateFormatter {
    formatDate: (iso: string | null | undefined) => string;
    formatTime: (iso: string | null | undefined) => string;
    formatDateTime: (iso: string | null | undefined) => string;
}

/**
 * Re-express an instant as a `Date` whose *local* getters (getHours, etc.)
 * return the wall-clock values for the given IANA timezone, so the
 * timezone-agnostic {@link formatPhpDate} renders the configured zone rather
 * than the browser's. Falls back to the original date when the timezone is
 * blank or invalid.
 */
function toZonedDate(date: Date, timeZone: string): Date {
    if (timeZone === '') {
        return date;
    }

    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(date);

        const lookup = (type: string): number =>
            Number(parts.find((part) => part.type === type)?.value ?? '0');

        // Intl emits "24" for midnight under hour12:false in some engines.
        const hour = lookup('hour') % 24;

        return new Date(
            lookup('year'),
            lookup('month') - 1,
            lookup('day'),
            hour,
            lookup('minute'),
            lookup('second'),
        );
    } catch {
        return date;
    }
}

export function useDateFormatter(): DateFormatter {
    const { keystone } = usePage<KeystoneSharedProps & Record<string, unknown>>().props;
    const formats = keystone.formats;

    const render = (iso: string | null | undefined, format: string): string => {
        if (iso === null || iso === undefined || iso === '') {
            return '';
        }

        const date = new Date(iso);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return formatPhpDate(toZonedDate(date, formats.timezone), format);
    };

    return {
        formatDate: (iso) => render(iso, formats.date),
        formatTime: (iso) => render(iso, formats.time),
        formatDateTime: (iso) => render(iso, `${formats.date} ${formats.time}`.trim()),
    };
}
