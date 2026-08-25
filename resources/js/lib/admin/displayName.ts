/**
 * Compute the WordPress-style display-name candidates from a user's identity
 * fields. Mirrors {@see Modules\Users\Models\User::displayNameCandidates} so the
 * admin Edit and Profile Settings dropdowns can update live as the operator
 * edits the name fields, without an extra round trip to the server.
 *
 * Order: username, first name, last name, "First Last", "Last First",
 * nickname. Duplicates are removed while preserving first-seen order, and
 * empty / whitespace-only fields are skipped.
 */
export interface DisplayNameInputs {
    first_name?: string | null;
    last_name?: string | null;
    nickname?: string | null;
    username?: string | null;
}

export function displayNameCandidatesFrom(inputs: DisplayNameInputs): string[] {
    const first = (inputs.first_name ?? '').trim();
    const last = (inputs.last_name ?? '').trim();
    const nickname = (inputs.nickname ?? '').trim();
    const username = (inputs.username ?? '').trim();

    const raw = [
        username,
        first,
        last,
        first && last ? `${first} ${last}` : '',
        first && last ? `${last} ${first}` : '',
        nickname,
    ];

    const seen = new Set<string>();
    const out: string[] = [];

    for (const candidate of raw) {
        if (candidate === '' || seen.has(candidate)) {
            continue;
        }
        seen.add(candidate);
        out.push(candidate);
    }

    return out;
}
