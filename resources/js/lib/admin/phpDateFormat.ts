/**
 * Minimal PHP `date()`-token formatter for client-side live previews.
 *
 * The settings store dates/times as PHP format strings (e.g. `F j, Y`) so the
 * server can render them with `Carbon::format()`. To preview a *custom* format
 * as the admin types — without a round trip — we reimplement the common tokens
 * here. Covers the tokens used by the presets plus the usual day/month/time
 * pieces; unknown characters pass through literally, matching PHP.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function pad(value: number): string {
    return value < 10 ? `0${value}` : String(value);
}

function ordinalSuffix(day: number): string {
    if (day >= 11 && day <= 13) {
        return 'th';
    }
    switch (day % 10) {
        case 1:
            return 'st';
        case 2:
            return 'nd';
        case 3:
            return 'rd';
        default:
            return 'th';
    }
}

/**
 * Format a date with a PHP `date()` format string. Supports a backslash escape
 * (`\\F`) to emit a literal token character, as PHP does.
 */
export function formatPhpDate(date: Date, format: string): string {
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const month = date.getMonth();

    let result = '';

    for (let i = 0; i < format.length; i += 1) {
        const char = format[i];

        if (char === '\\') {
            result += format[i + 1] ?? '';
            i += 1;
            continue;
        }

        switch (char) {
            // Day
            case 'd':
                result += pad(dayOfMonth);
                break;
            case 'j':
                result += String(dayOfMonth);
                break;
            case 'D':
                result += DAYS[dayOfWeek].slice(0, 3);
                break;
            case 'l':
                result += DAYS[dayOfWeek];
                break;
            case 'N':
                result += String(dayOfWeek === 0 ? 7 : dayOfWeek);
                break;
            case 'w':
                result += String(dayOfWeek);
                break;
            case 'S':
                result += ordinalSuffix(dayOfMonth);
                break;
            // Month
            case 'm':
                result += pad(month + 1);
                break;
            case 'n':
                result += String(month + 1);
                break;
            case 'M':
                result += MONTHS[month].slice(0, 3);
                break;
            case 'F':
                result += MONTHS[month];
                break;
            // Year
            case 'Y':
                result += String(date.getFullYear());
                break;
            case 'y':
                result += String(date.getFullYear()).slice(-2);
                break;
            // Time
            case 'g':
                result += String(hours12);
                break;
            case 'G':
                result += String(hours24);
                break;
            case 'h':
                result += pad(hours12);
                break;
            case 'H':
                result += pad(hours24);
                break;
            case 'i':
                result += pad(date.getMinutes());
                break;
            case 's':
                result += pad(date.getSeconds());
                break;
            case 'a':
                result += hours24 < 12 ? 'am' : 'pm';
                break;
            case 'A':
                result += hours24 < 12 ? 'AM' : 'PM';
                break;
            default:
                result += char;
        }
    }

    return result;
}
