---
name: diagram-export
description: >-
  How to add or change a guide diagram so it also ships an indexable image for
  SEO / AI search, the registry-driven way. Use when creating or editing a guide
  diagram component, adding an entry to DIAGRAM_COMPONENTS, running the diagram
  exporter, fixing a failing `diagrams:check` CI gate, or when the user asks to
  "add a diagram", "export diagrams", "diagram SEO", "image sitemap", or "the
  diagram image is stale". Follows docs/diagrams/diagram-standards.md (the visual
  rules) — read that for the frame/palette/type system. Pairs with the
  otd-content-writing skill (the prose side).
---

# Diagram export

Guide diagrams render as responsive HTML/CSS **components** (see
`docs/diagrams/diagram-standards.md` for *why* — scaled SVGs go illegible on
phones). Components have no `<img>`, so they're invisible to Google Images and AI
multimodal surfaces. This skill is the workflow that gives every diagram an
**additive** indexable image without touching the on-page component.

The visual standard lives in `docs/diagrams/diagram-standards.md`. This skill is
the **executable export workflow** — don't duplicate the standard, follow it.

**Writing the surrounding lesson prose?** That's the other half — use the
**otd-content-writing** skill (house voice + honest SEO). This skill owns the
image; that one owns the words.

## The one rule

**Registration is the trigger.** A diagram that's in `DIAGRAM_COMPONENTS`
([`src/components/guide/diagram-registry.tsx`](../../src/components/guide/diagram-registry.tsx))
MUST have a committed exported image + manifest entry. CI enforces it.

## Adding or changing a diagram

1. Build the component to `diagram-standards.md` (frame, palette, type, mobile
   legibility). Give `DiagramFrame` an accurate `ariaLabel` — **it becomes the
   image's `alt`**, so write it as real teaching prose, not a label.
2. Register it in `DIAGRAM_COMPONENTS` (key `/guide-diagrams/<basename>.svg` →
   component). The key's basename is the export filename.
3. Start the dev server (it must be up; the exporter screenshots a live route):
   `Start-Process pnpm.cmd dev -WindowStyle Hidden` (a harness-backgrounded
   `next dev` dies on the next tool call — use Start-Process).
4. Run `pnpm diagrams:export`. It renders each diagram at `/diagram-render/<basename>`
   in headless Chromium (reduced-motion forced so the entrance animation shows its
   final state), screenshots `figure[role="img"]` at 2×, encodes WebP into
   `public/guide-diagrams/<basename>.webp`, and reads `aria-label` into
   `src/components/guide/diagram-export-manifest.json`.
5. **Eyeball the new `.webp`** — brand-correct, legible, nothing clipped.
6. Commit the component, the registry change, the `.webp`(s), and the manifest
   together.

## Verifying

- `pnpm diagrams:export --only=<basename>` exports a single diagram (validation;
  doesn't write the manifest).
- `pnpm diagrams:check` (also the CI gate) renders every registered diagram and
  fails if one is **missing its image** or its **alt text drifted** from the
  manifest. It does NOT compare pixels — WebP bytes differ across OS/font
  rendering, so a purely visual edit won't trip CI. **Re-run `diagrams:export`
  and commit after any visual change**, even though CI can't catch that drift.

## Discovery (image sitemap)

[`/sitemap-images.xml`](../../src/app/sitemap-images.xml/route.ts) binds each
exported image to the public guide page(s) that embed it (a diagram is an `image`
content block whose `src` is the registry key). PUBLIC projects list every stage;
PREMIUM list only the REQUIREMENTS preview. Nothing to do per-diagram — it's
derived from the registry + manifest + guide content.

## Gotchas

- The `/diagram-render` route is dev/CI-only — it 404s in production unless
  `DIAGRAM_EXPORT=1` (set in the CI step). It's marked public in
  `src/lib/admin-routes.ts` so the headless exporter (no session) isn't bounced
  to `/sign-in`.
- Don't triple-label for accessibility: where a diagram has a visible
  `<figcaption>`, don't also stack a figure `aria-label` and an `<img alt>` all
  saying the same thing.
- Format policy: standalone SVG for genuinely-vector diagrams; WebP for the
  HTML/CSS-component diagrams (all current ones).
