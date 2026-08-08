# landing-page

Static, JS-free landing page for Notion Ultimate Brain — Even Realities G2, adapted from a
locally-derived copy of the Even Hub developer portal's markup.

Open `index.html` directly, or serve it:

```sh
python3 -m http.server 8000
```

## Layout

```
index.html            marketing page, no <script> tags
legal.html            privacy policy + terms of use, served at /legal
css/
  inline-a.css        the page's 4 inline <style> blocks (before the sheets)
  entry.css           main bundle (236 KB) — Tailwind utilities + theme
  button.css          button component styles
  index.css           route styles
  inline-b.css        5th inline block (after the sheets)
  static.css          the only hand-written file — see below
fonts/                FK Grotesk Neue Light/Regular, EvenSignature
img/                  hero, card art, brand signature, favicon
```

The site header has been removed: its markup, the `h-header*` utilities and
`--spacing-header*` custom properties, the logo asset, and the logo's iconify
rule are all gone. The page now starts at `<main>`. One side effect worth
knowing: the hero sits ~56px higher, which moves the glasses into a darker band
of the bottom-anchored radial gradient, so they read with less contrast than on
the original. Add top padding to the hero section if you want the old framing back.

**Cascade order matters.** The original interleaves inline `<style>` blocks with
its external sheets; `inline-a` / `inline-b` preserve that exact order. Reordering
the `<link>` tags will change the rendering. Every page carries the same six links
in the same order.

**Adding a page?** `build` in `package.json` names its HTML files literally
(`cp -R index.html legal.html css fonts img dist/`), so a new page that isn't added
to that list silently never reaches `dist/` — and the deploy succeeds anyway. Asset
paths are relative, so pages must also stay at the app root, not in a subdirectory.

**`entry.css` is a compiled bundle: you can't invent Tailwind classes.** It only
contains the utilities the original Even Realities site happened to use, so a class
that looks obviously fine (`mb-8`, `bp:flex-row`, `prose`, `list-disc`,
`hover:opacity-80`) may simply not exist and will do nothing. Grep `entry.css`
before relying on a class, and add anything genuinely missing to `static.css` —
that's why `bp:grid-cols-2` and the `.legal-prose` / `.site-footer` blocks live there.

## How it was derived

The site is Nuxt 3 with server-side rendering, so the markup arrives complete in
the HTML response. The mirror keeps that markup as-is and drops the Nuxt runtime.

Two things did **not** survive removing the JS:

1. **Dark mode** — an inline script set `class="dark"` from `localStorage`. Now
   hardcoded on `<html>`; without it the whole page renders light.
2. **Hero lens animation** — four screens (Dashboard, Ebook, Bus, Sport) that Vue
   crossfaded on a timer. Reimplemented as a 12s CSS keyframe cycle in
   `css/static.css`, so the build stays script-free. Honours `prefers-reduced-motion`.

The icons needed no such treatment: although Nuxt Icon renders them at runtime,
the shipped inline styles already carry each icon's artwork as a `--svg` data URI
on the `:where(.i-er\:…)` rules, so the arrows work from the site's own CSS.

Also note:
- `data-v-*` attributes are load-bearing — the scoped CSS selects on them. Don't strip them.
- `srcset` was removed; it pointed at server-side IPX image variants that don't exist locally.
- `/hub` (auth-gated console) and `/docs` (separate VitePress app) are not mirrored;
  links to them point at the live site.
- The original Nuxt footer didn't survive either (`<!--v-if-->` marks where it rendered).
  The current footer is this project's own — plain markup shared verbatim by both pages,
  styled by `.site-footer*` in `static.css`. Edit it in both files or they'll drift.

## Provenance

All content, imagery, and branding belong to Even Realities; the bundled
FK Grotesk Neue fonts are commercially licensed to them (© Florian Karsten).
This is a local copy for development reference — it isn't cleared for
redistribution or public hosting as-is.
