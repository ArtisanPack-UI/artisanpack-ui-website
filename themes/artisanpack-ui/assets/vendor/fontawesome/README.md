# Font Awesome 7.3.1 Pro Plus

Installed:

- `css/all.min.css` — imported by `../../../css/theme.css`
- `webfonts/*.woff2` — all 38 Pro Plus font files (families: solid, regular, light, thin, duotone, sharp variants, brands, plus the Plus-tier decorative families: chisel, etch, graphite, jelly, mosaic, notdog, pixel, slab-*)
- `LICENSE.txt`

`all.min.css` resolves `../webfonts/*` relative to itself, so the `css/` + `webfonts/` sibling layout must stay intact.

If you want to trim the bundle later, only the families the icon manifest actually uses need to ship. `/build-theme` will produce that manifest and can prune unused webfonts + subset the CSS at bundle time.
