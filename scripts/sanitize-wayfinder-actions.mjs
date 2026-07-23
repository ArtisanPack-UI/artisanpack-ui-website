#!/usr/bin/env node
/*
 * Post-process Wayfinder's generated `resources/js/actions/` output to
 * de-duplicate object literal keys.
 *
 * When a Laravel controller method backs more than one HTTP verb on the
 * same URI — typical with Route::apiResource(), which registers both PUT
 * and PATCH for the `update` action against the same path — Wayfinder
 * emits an object literal keyed by URI with one entry per registered
 * route. Two routes on the same URI ⇒ two entries with the same string
 * key, which TypeScript rejects (TS1117) and which is also redundant at
 * runtime since both entries point at the same backing function.
 *
 * We walk every .ts file under resources/js/actions/, find object
 * literals (`export const NAME = { ... }`), and drop subsequent lines
 * that repeat a string-literal key already seen in the same literal.
 * Non-Wayfinder code is untouched because this only fires after
 * `php artisan wayfinder:generate` writes into the actions/ tree.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const ACTIONS_ROOT = resolve(process.cwd(), 'resources/js/actions')

async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...(await walk(full)))
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            files.push(full)
        }
    }
    return files
}

// Matches a single object-literal entry line like:
//     '/api/v1/comments/{comment}': update52a933d9aeb8626c77ddf332c504e418,
const ENTRY_LINE = /^(\s*)(['"])([^'"]+)\2\s*:/

function dedupeFile(source) {
    const lines = source.split('\n')
    const out = []
    let inLiteral = false
    let seen = null

    for (const line of lines) {
        if (!inLiteral) {
            // Heuristic: opening of a top-level object literal export.
            // `export const NAME = {` on its own line (Wayfinder's format).
            if (/^export const \w+ = \{\s*$/.test(line)) {
                inLiteral = true
                seen = new Set()
            }
            out.push(line)
            continue
        }

        // Inside the literal — watch for its close.
        if (/^\}\s*$/.test(line)) {
            inLiteral = false
            seen = null
            out.push(line)
            continue
        }

        const match = line.match(ENTRY_LINE)
        if (match) {
            const key = match[3]
            if (seen.has(key)) {
                // Drop the duplicate entry. Wayfinder emits one route per
                // verb but they share the same backing reference, so the
                // first entry already covers it.
                continue
            }
            seen.add(key)
        }
        out.push(line)
    }

    return out.join('\n')
}

const files = await walk(ACTIONS_ROOT).catch((err) => {
    if (err.code === 'ENOENT') {
        console.log(`[sanitize-wayfinder-actions] ${ACTIONS_ROOT} not found — skipping.`)
        return []
    }
    throw err
})

let touched = 0
for (const file of files) {
    const source = await readFile(file, 'utf8')
    const next = dedupeFile(source)
    if (next !== source) {
        await writeFile(file, next, 'utf8')
        touched += 1
    }
}

if (touched > 0) {
    console.log(`[sanitize-wayfinder-actions] de-duped object literal keys in ${touched} file(s).`)
}
