#!/usr/bin/env node
/**
 * Refresh the Playwright browser bundle so it matches the version
 * pinned by `playwright` in devDependencies.
 *
 * Runs as part of `postinstall`. After a Playwright version bump the
 * previously-downloaded browser binaries go stale and every
 * `tests/Browser/**` test fails with `PlaywrightOutdatedException`
 * (see #94). `playwright install` is a fast no-op when the browsers
 * are already at the right version, so wiring it here means fresh
 * checkouts and dev machines self-heal.
 *
 * Guarded: exits 0 without running when Playwright's `cli.js` isn't
 * present (production/CI installs with `--omit=dev`, or partially
 * installed trees). Executes that CLI directly via `node` rather
 * than routing through `npx` so npm can never fall back to fetching
 * `playwright` from the registry.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const playwrightCli = join(projectRoot, 'node_modules/playwright/cli.js');

if (!existsSync(playwrightCli)) {
    console.log(
        `[ensure-playwright-browsers] ${playwrightCli} not present (devDependencies omitted or install incomplete) — skipping browser install.`,
    );
    process.exit(0);
}

const result = spawnSync(process.execPath, [playwrightCli, 'install'], {
    cwd: projectRoot,
    stdio: 'inherit',
});

if (result.status !== 0) {
    console.error(
        `[ensure-playwright-browsers] \`playwright install\` failed with status ${result.status}.`,
    );
    process.exit(result.status ?? 1);
}
