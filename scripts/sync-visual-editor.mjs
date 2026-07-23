#!/usr/bin/env node
/**
 * Copy the prebuilt artisanpack-ui/visual-editor bundle into
 * `public/visual-editor/` as a real directory.
 *
 * The visual-editor package ships its editor entry under
 * `dist/editor/` and the bundle resolves chunks relative to its own
 * URL (built with `base=/visual-editor/`). We surface those files at
 * `/visual-editor/*` on the web root by copying — not symlinking —
 * so deployment environments that don't preserve symlinks (Docker
 * COPY, rsync without `-l`, some PaaS deploys) still resolve the
 * editor's chunks.
 *
 * Runs as `postinstall` so dev/CI/deploy installs all keep the
 * webroot in sync. If the vendor source isn't present (CI jobs that
 * skip `composer install`), the script exits 0 with a notice — the
 * downstream job either doesn't need the editor assets or will
 * re-run this after composer.
 */

import { existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const source = join(
    projectRoot,
    'vendor/artisanpack-ui/visual-editor/dist/editor',
);
const target = join(projectRoot, 'public/visual-editor');

if (!existsSync(source)) {
    console.log(
        `[sync-visual-editor] Source not found at ${source} — skipping (run \`composer install\` to populate).`,
    );
    process.exit(0);
}

// Remove the existing target (including any stale symlink) so the
// copy operation always lands a fresh directory.
if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`[sync-visual-editor] Copied ${source} → ${target}`);
