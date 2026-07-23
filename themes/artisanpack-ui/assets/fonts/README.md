# Fonts

## Installed

Poppins is installed as `.ttf` (Google Fonts download), renamed to weight-based filenames:

- `poppins-300.ttf` (Light)
- `poppins-400.ttf` (Regular) · `poppins-400-italic.ttf`
- `poppins-500.ttf` (Medium) · `poppins-500-italic.ttf`
- `poppins-600.ttf` (SemiBold) · `poppins-600-italic.ttf`
- `poppins-700.ttf` (Bold)
- `poppins-800.ttf` (ExtraBold)

`css/theme.css` `@font-face` rules reference these with `format('truetype')`.

## Not yet installed

Space Mono. Falls back to platform monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas`) until dropped in.

Grab from https://fonts.google.com/specimen/Space+Mono and drop the following into this directory:

- `space-mono-400.ttf` (Regular) · `space-mono-400-italic.ttf`
- `space-mono-700.ttf` (Bold) · `space-mono-700-italic.ttf`

Then add matching `@font-face` rules to `css/theme.css` (mirror the Poppins block).

## Conversion to woff2 (later)

TTFs work fine but are ~2× the wire size of woff2. When bundling the deployable theme in `/build-theme`, run TTFs through a converter (e.g. `pyftsubset` from `fonttools`, or `woff2_compress`) and swap the `@font-face` `format()` to `woff2`.
