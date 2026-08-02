# landing-page

Static, JS-free landing page for Notion Ultimate Brain — Even Realities G2, adapted from a
locally-derived copy of the Even Hub developer portal's markup.

Open `index.html` directly, or serve it:

```sh
python3 -m http.server 8000
```

## Layout

```
index.html            single page, no <script> tags
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
the `<link>` tags will change the rendering.

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
  the footer links point at the live site.

## Provenance

All content, imagery, and branding belong to Even Realities; the bundled
FK Grotesk Neue fonts are commercially licensed to them (© Florian Karsten).
This is a local copy for development reference — it isn't cleared for
redistribution or public hosting as-is.
