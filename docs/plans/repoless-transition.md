# Transition Plan: artisanpackui.dev to a Repo-less Keystone Install

**Status:** Draft — awaiting Phase 0 kickoff
**Written:** 2026-08-01
**Audience:** Jacob + coding agents. Each phase is written to be workable top-to-bottom; check items off as they land.

---

## Spec Summary

**Goal.** Retire the `ArtisanPack-UI/artisanpack-ui-website` monorepo-style deployment. The production site at **artisanpackui.dev** becomes a plain Keystone CMS install on the existing Forge/DigitalOcean droplet — installed from a Keystone release zip, updated by Keystone's own self-updater, with no git repo and no CI/CD pipeline attached to the site itself. The only repos that remain are:

- `ArtisanPack-UI/artisanpack-ui-theme` (new) — the marketing theme currently at `themes/artisanpack-ui`
- `ArtisanPack-UI/artisanpack-ui-plugin` (new) — the site plugin currently at `plugins/artisanpack-ui`

This mirrors the WordPress model: the platform manages itself; custom code lives in theme/plugin repos.

**Constraints.**

- Keystone releases are built by GitLab CI in `jmwd-keystone-cms` as a **`.zip`** (hard requirement — `ApplicationUpdateManager::extractUpdate()` uses `ZipArchive`, no tarball support).
- The production site is live with a splash page; it must stay up throughout. Content-preservation risk is low but not zero (check for uploaded media in Phase 0).
- The current Forge site is git-linked to the GitHub repo. Forge sites can't cleanly un-link a repo, so cutover happens via a **new Forge site + domain swap**, not in-place conversion.
- Installer work belongs in **jmwd-keystone-cms** (GitLab). Theme/plugin update-source work belongs in **ArtisanPack-UI/cms-framework** (GitHub). This plan references those repos' issues; it does not duplicate the work here.

**Approach.** Five phases: (0) freeze and baseline, (1) harden the Keystone installer upstream, (2) extract theme + plugin into fresh GitHub repos, (3) provision a new repo-less Forge site and install everything, (4) cut the domain over and archive this repo. GitHub-release-zip self-updates for theme/plugin are **post-cutover** work (Phase 5) — manual install is acceptable for launch.

**Non-goals.**

- Multi-tenancy. One install per site, full stop.
- A hosting control panel or Forge-API provisioning script (noted as future work; the runbook from this transition is its seed).
- Preserving git history in the extracted repos — both start fresh; history stays findable in the archived website repo.
- Migrating the in-flight Updates-system changes upstream — they are already upstream in jmwd-keystone-cms.

**Open questions.**

- Final repo names (`artisanpack-ui-theme` / `artisanpack-ui-plugin` proposed below — adjust at Phase 2 if desired).
- Temp verification domain for the new Forge site (plan assumes `next.artisanpackui.dev`).
- How the server authenticates to GitLab to download Keystone release zips (private project → needs a read-only access token in the site's `.env`; confirm the variable names cms-framework's `GitLabUpdateSource` expects when configuring Phase 3).

---

## Current State (verified 2026-08-01)

| Thing | State |
| --- | --- |
| Production | artisanpackui.dev, live splash page, Forge site on DO droplet, git-deployed from `ArtisanPack-UI/artisanpack-ui-website` |
| This repo | Branch `feature/prod-website`; working tree has uncommitted Updates-system changes that are copies of work already landed upstream in jmwd-keystone-cms |
| App code | Effectively stock Keystone (`laravel/jmwd-keystone-cms` v0.3.2 vendored as the app itself); real customization is confined to `themes/artisanpack-ui` and `plugins/artisanpack-ui` |
| Theme | `themes/artisanpack-ui` — theme.json-driven (templates, parts, patterns, styles, `Theme.php`), v1.0.0, requires cms-framework ^2.0 conventions |
| Plugin | `plugins/artisanpack-ui` — `plugin.json` + `src/`, v0.1.0, service provider `ArtisanPackUI\Site\ArtisanPackUIServiceProvider`, requires cms-framework ^2.5 |
| Keystone installer | Exists (`keystone:install` → `app/Console/Commands/InstallCommand.php`, `app/Installer/InstallationService.php`, plus a web `InstallController`) but has known fresh-install bugs — see Phase 1 |
| App self-update | cms-framework `ApplicationUpdateManager` with `GitLabUpdateSource` / `GitHubUpdateSource` / `CustomJsonUpdateSource`; consumes the GitLab release zip |
| Plugin updates | cms-framework `Plugins/Managers/UpdateManager` checks a custom `update_url` JSON endpoint from plugin meta — **no GitHub-release source** |
| Theme updates | **None** — `ThemeManager` handles install/activate only |

Relevant upstream issues (jmwd-keystone-cms, GitLab):

- **#114** Release zip excludes `.env.example` (blocks fresh-install `.env` bootstrap)
- **#115** `storage/framework/{views,sessions}` missing after unzip (blocks first artisan call)
- **#116** Fresh install 404s at `/` — no seeded homepage (low priority)
- **#117** Media upload fails: `MediaStoreRequest` does not exist (critical)
- **#118** Installer drops `--site-type`, `--business-name`, `--primary-domain` (critical)
- **#31** Run `keystone:install` against production + import theme (this plan supersedes/executes it)
- **#34** Document the new-client setup runbook (Phase 3 produces the material for it)
- **#217** Extract Installer module (modular-setup refactor — do **not** block on this)

---

## Phase 0 — Freeze & Baseline (this repo + prod)

Goal: a clean, committed final state of this repo and a confirmed inventory of what production holds.

- [ ] **Commit the working tree.** On `feature/prod-website`, commit all pending changes (they mirror upstream Keystone 0.3.2 — committing keeps the archive coherent). Merge `feature/prod-website` → `main`, push both.
- [ ] **Tag the final state:** `git tag archive/final-monorepo && git push origin archive/final-monorepo`.
- [ ] **Inventory production.** SSH to the droplet (or use Forge):
  - [ ] Note the existing Forge site name, PHP version, and database name/credentials.
  - [ ] Check `storage/app/public` (or the media library) for any uploaded media worth copying off. Splash page implies little/none — verify rather than assume.
  - [ ] Export the production database once as a safety snapshot (`mysqldump`), stash it locally. It will likely never be needed (content gets recreated), but it's cheap.
- [ ] **Confirm droplet capacity** for running two sites side-by-side during Phases 3–4 (disk + memory headroom for a second PHP-FPM pool and database).

**Done when:** repo is pushed and tagged; you know exactly what prod contains; snapshot taken.

---

## Phase 1 — Keystone Installer Hardening (jmwd-keystone-cms, GitLab)

Goal: a Keystone release zip that installs cleanly from scratch via `keystone:install`. This is the load-bearing prerequisite — the new prod site is born from this artifact.

> **Scope note:** the longer-term vision is a *standalone installer* — a separate package/small app with a terminal or web UI that bootstraps a new site, in the spirit of Winter CMS's [web-installer](https://github.com/wintercms/web-installer) and October CMS's [install](https://github.com/octobercms/install). That gets specced and planned inside jmwd-keystone-cms, not here. This phase only hardens the *existing* in-app `keystone:install` path enough to birth this one site — work that any future standalone installer builds on top of (it would drive the same release zip + install flow), so nothing here is throwaway.

Work happens in `~/Herd/jmwd-keystone-cms` against `gitlab.com/jacob-martella-web-design/.../jmwd-keystone-cms`.

- [ ] **Fix #114** — release zip must include `.env.example` (adjust the `build_release` CI job's zip contents).
- [ ] **Fix #115** — ensure `storage/framework/{cache,views,sessions,testing}` exist post-unzip (ship `.gitkeep`s in the zip or create them in `keystone:install` before any artisan bootstrapping — prefer the installer creating them, so old zips also heal).
- [ ] **Fix #117** — restore/create `App\Http\Requests\Media\MediaStoreRequest` (media upload is table-stakes for the new site).
- [ ] **Fix #118** — persist `--site-type`, `--business-name`, `--primary-domain` through `InstallationService`.
- [ ] **Optionally fix #116** (seeded placeholder homepage) — nice for client installs; not blocking since the theme provides the real homepage.
- [ ] Each fix ships with Pest coverage per the Keystone repo's own conventions.
- [ ] **Cut a release** (next patch/minor, e.g. `v0.3.3`): tag, let the GitLab pipeline build the zip + sha256.
- [ ] **Local rehearsal (acceptance test for this phase):** in a scratch directory —
  1. Download the release zip from GitLab (same auth path the server will use).
  2. Unzip; run `php artisan keystone:install` with full flags non-interactively.
  3. Verify: admin login works; media upload works; `--site-type`/`--business-name`/`--primary-domain` persisted; no missing-directory errors.
  4. Install a theme zip and a plugin zip through the admin (use Phase 2 artifacts if ready) and activate both.
- [ ] Record every command from the rehearsal — that transcript is the draft runbook for **#34** and the script for Phase 3.

**Done when:** a tagged release installs from zip to working admin with zero manual filesystem surgery.

---

## Phase 2 — Extract Theme & Plugin to GitHub (parallel with Phase 1)

Goal: two fresh repos in the ArtisanPack-UI org, each producing an installable zip.

Before creating zips, **check what cms-framework's installers expect**: read `ThemeManager` and `PluginManager` install paths in `vendor/artisanpack-ui/cms-framework/src/Modules/{Themes,Plugins}/Managers/` to confirm required zip layout (root folder name = slug? manifest at zip root?). Match that exactly.

### `ArtisanPack-UI/artisanpack-ui-theme`

- [ ] Create the GitHub repo (private or public — your call; public fits the org story).
- [ ] Copy `themes/artisanpack-ui/*` in as the repo root. Fresh `git init`, initial commit `v1.0.0 — extracted from artisanpack-ui-website`.
- [ ] Add `README.md` (what it is, how to build the install zip, link back to the archived website repo for pre-history) and `LICENSE` (MIT, matching plugin.json conventions).
- [ ] Tag `v1.0.0`; attach a GitHub Release with the install zip built to the layout confirmed above.

### `ArtisanPack-UI/artisanpack-ui-plugin`

- [ ] Same procedure with `plugins/artisanpack-ui/*`; initial tag `v0.1.0`.
- [ ] Verify `plugin.json` `requires.cms-framework` matches the cms-framework version shipping in the Phase 1 Keystone release.

### Both

- [ ] **Round-trip test locally:** on a fresh Phase 1 rehearsal install, upload each release zip via the Keystone admin, activate, and confirm the site renders the theme and the plugin's admin nav appears.
- [ ] Defer CI (lint/test/release automation) — file a housekeeping issue in each repo instead of building it now.
- [ ] From this point, **theme/plugin development happens in the new repos**; the copies in this repo are dead.

**Done when:** both repos exist with tagged releases whose zips install cleanly into a fresh Keystone.

---

## Phase 3 — Provision the New Forge Site & Install

Goal: a fully working, repo-less copy of the site on the droplet, verified on a temp domain, while the old splash page keeps serving production traffic.

- [ ] **Forge: create the site.** Same droplet. Domain `next.artisanpackui.dev` (add the DNS record first). **Skip the repository step entirely.** Enable site isolation (own system user). PHP version matching the Keystone release's requirement. Web directory `/public`.
- [ ] **Forge: create the database** + dedicated DB user for the site.
- [ ] **Install Keystone** (this is the runbook — capture deviations back into issue #34):
  1. SSH as the site's isolated user; `cd` to the site root and clear Forge's default scaffold.
  2. Download the Phase 1 release zip from GitLab (using the read-only token; verify sha256).
  3. Unzip into the site root.
  4. `php artisan keystone:install` with full flags: site name, admin credentials, DB credentials, `--primary-domain=artisanpackui.dev` (the real domain — the temp domain is just for verification), `--site-type`, `--business-name`.
  5. Configure the self-update source in `.env` (GitLab source, project ID, token).
- [ ] **Forge plumbing:** scheduler cron (`php artisan schedule:run` every minute), queue worker daemon if the install uses one, SSL cert for the temp domain.
- [ ] **Validate the update path on the droplet early** (the one caveat from the original architecture discussion): run `php artisan` update-check command against the GitLab source and confirm it resolves the current release. If a newer release exists, run one full CLI self-update. This path is load-bearing for every future client site — prove it on real infrastructure now.
- [ ] **Install theme + plugin** via admin upload of the Phase 2 release zips; activate both.
- [ ] **Rebuild the site content** (splash page and whatever the prod-website work adds) through the CMS itself. Copy over any media identified in Phase 0.
- [ ] **Full verification on `next.artisanpackui.dev`:** public pages render, admin works, media upload works, forms/SEO/analytics behave, no mixed-content or hardcoded-domain issues.

**Done when:** the temp domain serves the complete site and the self-updater works on the droplet.

---

## Phase 4 — Cutover & Decommission

Goal: artisanpackui.dev serves the new install; old site and repo retired.

- [ ] **Pre-flight:** re-verify the temp domain end-to-end; confirm the new install's `APP_URL`/primary domain is set to `artisanpackui.dev`.
- [ ] **Swap the domain:** in Forge, remove `artisanpackui.dev` from the old site and add it (as primary) to the new site; update the DNS record if it pointed anywhere unusual; obtain/renew SSL for `artisanpackui.dev` on the new site.
- [ ] Verify production immediately: homepage, admin login, media, SSL chain.
- [ ] **Rollback path** (keep available for ~1 week): the old Forge site stays intact but domain-less; re-attaching the domain to it restores the splash page in minutes.
- [ ] After the stability window:
  - [ ] Delete the old Forge site (and its now-unused database, after confirming the snapshot from Phase 0 still exists).
  - [ ] **Archive `ArtisanPack-UI/artisanpack-ui-website`** on GitHub. First, replace its README top section with a pointer: site is now a repo-less Keystone install; theme lives in `artisanpack-ui-theme`; plugin lives in `artisanpack-ui-plugin`.
  - [ ] Remove the temp domain + its DNS record.
  - [ ] Delete or retire the local `~/Herd/artisanpack-ui` working copy in favor of a fresh local dev setup (local Keystone install with the theme/plugin repos cloned into `themes/` and `plugins/` — same shape as prod).

**Done when:** production serves from the repo-less install, the old site is gone, and the website repo is archived.

---

## Phase 5 — GitHub-Release Self-Updates for Theme & Plugin (post-cutover)

Goal: theme and plugin update themselves from GitHub Releases, WordPress-style — no more manual zip uploads.

This is **cms-framework** work (`github.com/ArtisanPack-UI/cms-framework`), consumed by Keystone. File these issues there as the first step:

- [ ] **Issue: plugin GitHub-release update source.** Today `Plugins/Managers/UpdateManager` only polls a custom `update_url` JSON from plugin meta. Add a GitHub Releases source (reuse the design of `Core/Updates/Sources/GitHubUpdateSource`), configured from `plugin.json` (e.g. an `update.github: "ArtisanPack-UI/artisanpack-ui-plugin"` key), with version comparison against release tags and zip download from release assets.
- [ ] **Issue: theme update manager.** Themes currently have no update path at all. Add parity with plugins: update check + zip install + rollback safety, driven by a matching key in `theme.json`.
- [ ] **Issue (Keystone): admin UI wiring** for theme/plugin update checks/actions in the Updates settings screen.
- [ ] Implement, release cms-framework, bump Keystone's dependency, cut a Keystone release.
- [ ] **Prove the loop on production:** self-update Keystone on the droplet to the new release, add the `update` keys to the live theme/plugin manifests (ship via one last manual zip upload), then tag a trivial patch release of each repo and confirm the live site sees and applies both updates on its own.

**Done when:** a `git tag` + GitHub Release in the theme or plugin repo is all it takes to update production.

---

## Future Work (explicitly out of scope)

- **Standalone Keystone installer** — a separate package/app (terminal and/or web UI, à la Winter CMS `web-installer` / October CMS `install`) that walks through creating a new site. To be specced in jmwd-keystone-cms; the Phase 1 hardening and Phase 3 runbook feed directly into it.
- **`keystone:provision` / Forge-API script** — one command to create site + DB + install Keystone for a new client. The Phase 3 runbook (issue #34) is the spec for it. Build it when client site #2 or #3 makes the manual runbook feel repetitive. (May end up being the terminal face of the standalone installer above.)
- **Theme/plugin repo CI** — lint/test on push, auto-build the release zip on tag.
- **Modular installer extraction (#217)** — happens on Keystone's own roadmap; nothing here depends on it.
