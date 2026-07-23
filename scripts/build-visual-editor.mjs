#!/usr/bin/env node
/* eslint-env node */
/**
 * Build the artisanpack-ui/visual-editor package's `dist/editor/` bundle
 * in-place inside the vendor directory.
 *
 * The package's `.gitignore` excludes `dist/`, and starting with
 * v1.0.0-beta1 the Packagist tarball stopped shipping the prebuilt
 * bundle too (see #87). Without `dist/editor/`,
 * `VisualEditorAssetController` returns 404 for every editor chunk and
 * `sync-visual-editor.mjs` has nothing to copy into `public/`.
 *
 * This script bridges that gap: after `composer install` puts the
 * package source under `vendor/`, it installs the package's own dev
 * dependencies and runs its `npm run build` so `dist/editor/` exists
 * before the sync step runs.
 *
 * Idempotent — skips the install + build when a sentinel build output
 * is already present so warm dev installs stay fast.
 *
 * Runs from `package.json`'s `postinstall` (chained before
 * `sync-visual-editor.mjs`). When the vendor source isn't present
 * (CI jobs that skip `composer install`), exits 0 with a notice so
 * downstream callers either re-run it after composer or skip the
 * editor assets entirely.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const packageDir = join(
    projectRoot,
    'vendor/artisanpack-ui/visual-editor',
);
const packageManifest = join(packageDir, 'package.json');
const packageLockfile = join(packageDir, 'package-lock.json');
const builtSentinel = join(packageDir, 'dist/editor/site-editor.js');

if (existsSync(builtSentinel)) {
    console.log(
        `[build-visual-editor] ${builtSentinel} already present — skipping build.`,
    );
    process.exit(0);
}

if (!existsSync(packageManifest)) {
    console.log(
        `[build-visual-editor] Vendor package not found at ${packageDir} — skipping (run \`composer install\` first, or this is a JS-only CI job).`,
    );
    process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
    console.log(`[build-visual-editor] ${npmCommand} ${args.join(' ')}`);
    const result = spawnSync(npmCommand, args, {
        cwd: packageDir,
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        console.error(
            `[build-visual-editor] \`${npmCommand} ${args.join(' ')}\` failed with status ${result.status}.`,
        );
        process.exit(result.status ?? 1);
    }
}

// `npm ci` requires `package-lock.json`. The Packagist dist tarball
// for this package doesn't always include the lockfile, so fall back
// to `npm install` when it's missing.
const installArgs = existsSync(packageLockfile)
    ? ['ci', '--no-audit', '--no-fund']
    : ['install', '--no-audit', '--no-fund'];

run(installArgs);
run(['run', 'build']);

if (!existsSync(builtSentinel)) {
    console.error(
        `[build-visual-editor] Build completed but ${builtSentinel} is still missing.`,
    );
    process.exit(1);
}

console.log(`[build-visual-editor] Built ${builtSentinel}.`);
