# Guide-diagram standards

Hand-authored SVGs in `public/guide-diagrams/` are rendered inside guide cards on
the dark app background. These rules keep them consistent and, above all, keep
annotations from crowding or overlapping. **Every diagram must pass the
[checklist](#pre-ship-checklist) before it ships.**

## Canvas

- `viewBox="0 0 780 360"`. No background rect — the page supplies `#08090D`.
- Keep a **≥ 24 px safe margin** inside the canvas edges.
- The **subject** (board / circuit) is centered; **annotations live in the
  gutters** around it. Center the subject so the left and right gutters are
  roughly equal — never strand every label on one side.

## Palette (1KD brand)

| Token | Hex | Use |
|---|---|---|
| Gold | `#c8963e` | board outline, part bodies, copper pads |
| Red | `#ef5350` | keep-outs, hazards, "must-not" zones |
| Blue | `#4a8fff` | signal / highlight callouts |
| Gray | `#8a8a8a` | leaders + neutral notes; pour hatch @ 0.32 opacity |
| White | `#ffffff` | primary labels (part name, ref, antenna trace) |
| Cleared | `#0b0f1a` | no-copper / cleared fill |

## Type (monospace — `ui-monospace, 'SFMono-Regular', Menlo, monospace`)

| Role | px | weight | color |
|---|---|---|---|
| Subject ref (e.g. `U1`) | 17 | 700 | `#fff` |
| Primary label (part name, `KEEP-OUT`) | 13–14 | 700 | `#fff` / semantic |
| Note / caption | 10–11 | 400 | `#8a8a8a` |

- Stacked-label line height: **15 px**. Left-align a label block; never mix text
  anchors inside one block.

## Layout rules

1. **Annotations live in the gutters, never on the subject** — two exceptions:
   a single centered ref (`U1`) inside a part body, and a **region label**
   centered inside its own filled region (a keep-out, a current loop, a pour),
   provided it clears every stroke by the same ≥ 16 px.
2. **Clearance:** a text block **or a standalone symbol** (ground, power port,
   capacitor, test point…) stays **≥ 16 px** from any stroke or symbol it does
   not electrically connect to, and text stays **≥ 12 px** from the canvas edge.
   Never tuck a ground or cap against an IC body, or crowd one symbol's leads
   onto another's. Connected strokes may of course touch.
3. **Text never touches a line.** No glyph may overlap a leader, outline, pad, or
   trace. (Text *may* sit over the faint background pour hatch — that is texture,
   not a line.)
4. **One leader per off-subject label; one concept per label.**
5. **Leaders:**
   - **Fixed angles only — 0°, 45°, or 90°.** No arbitrary slopes. A leader is a
     single segment at one of those angles, or one elbow joining two of them
     (e.g. a 45° run into a short horizontal stub at the label). This is what
     makes a set of leaders read as intentional rather than scattered.
   - Start **≥ 12 px** from the label — a clear gap, never sprung from the glyphs.
   - **A leader must not run level with its own label's text.** A horizontal
     leader sitting at the text's height reads as crowding even with a gap —
     put the label above/below and lead away vertically, or otherwise offset the
     leader from the text band.
   - End **2–4 px short** of the target stroke.
   - **Never cross another leader, the subject body, or any text.**
   - Color = the label's semantic color (red label → red leader; note → gray).
   - 1 px weight.
6. **Gutter assignment:** put each label in the gutter nearest its target. Top =
   "what is this" callouts; left / right = component labels; bottom = the
   dominant-fill note (e.g. ground pour). Keep **≥ 18 px** between two labels
   sharing a gutter.

## Pre-ship checklist

- [ ] No text overlaps any line / stroke / pad / trace.
- [ ] No symbol (ground, power port, cap…) crowds a stroke it doesn't connect to.
- [ ] Every leader has a gap at the text end and stops short of its target.
- [ ] Every leader runs at 0° / 45° / 90° (single segment or one elbow).
- [ ] No two leaders cross; none crosses the subject or any text.
- [ ] All labels in gutters; ≥ 16 px clearance to unrelated strokes.
- [ ] Subject centered; left / right gutters roughly balanced.
- [ ] Palette + type sizes match the tables above.
- [ ] Rendered at 2× on `#08090D` and eyeballed.

## Rendering / verification

Render an SVG to a PNG on the real background before shipping:

```py
# /c/tmp/render-svg.py — load the SVG on #08090D, screenshot at 2×
from playwright.sync_api import sync_playwright
import pathlib
svg = pathlib.Path(SVG_PATH).read_text(encoding="utf-8")
html = f'<!doctype html><html><body style="margin:0;background:#08090D;padding:24px">{svg}</body></html>'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(device_scale_factor=2)
    pg.set_content(html, wait_until="networkidle")
    pg.screenshot(path=OUT_PNG); b.close()
```

## Inventory

| File | Subject | Conforms |
|---|---|---|
| `antenna-keepout.svg` | WROOM antenna keep-out (top view) | ✅ reference |
| `decoupling-placement.svg` | decoupling loop area | ✅ |
| `bringup-probe-points.svg` | rail probe points | ✅ |
| `wroom-power-flow.svg` | 5 V → 3.3 V power flow | ✅ |
| `schematic-conventions.svg` | KiCad schematic-drawing conventions | ✅ |
