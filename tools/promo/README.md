# The promo render pipeline

The browser renders the film; these drive it. They lived in a session scratchpad
until 2026-08-11, which meant the repo held every STAGE and none of the scripts
that turn a stage into an mp4. A new window inherited an unrunnable pipeline.

Everything here needs `pnpm dev` on **:3200** (the scripts hardcode it) and
ffmpeg on PATH. Nothing here writes to prod.

| script | what it does |
| --- | --- |
| `build-picture.mjs <scratch> <format>` | Renders the PICTURE halves: the three.js handoff and the certificate card, then muxes the exam push-in. Per aspect, because the cut draws segments with `object-fit: cover` and a 16:9 render in a 9:16 frame loses the outer 68%. Band is finish-only (it shares wide's handoff). |
| `render-cut.mjs <scratch> <format> [--no-type]` | The 10 s cut, scrubbed frame by frame, with the bed muxed. `--no-type` suppresses the cue layer for surfaces that supply their own copy. |
| `measure-cut.mjs <out> [formats...]` | Checks the type landed where `placeEarn` INTENDED, against the platform chrome box, and fails on a solved gap under 2%. |
| `chrome-overlay.mjs <out>` | Paints the action rail, caption block and top chrome onto real frames so clearance is something you look at. |
| `measure-subject.mjs <out>` | Luminance centroid per beat. Catches the subject wandering horizontally between shots. |
| `capture-plates.mjs <out> <token> <key.json> <formats...>` | Re-captures the exam plate at each narrow viewport. Needs a session cookie from `scripts/_promo-session.ts` and the key from `scripts/_exam-key.ts`. |

## The order

```
pnpm dev                                        # :3200
node tools/promo/build-picture.mjs <scratch> wide
node tools/promo/render-cut.mjs   <scratch> wide
node tools/promo/measure-cut.mjs  <scratch>/out wide
```

## Two traps these encode

**Scrub, never play.** Every frame comes from awaiting `__cutSet(t)`. A frame may
take any amount of wall clock and the picture cannot drift. An animation left
running lands wherever real time reached.

**A check that compares a render to its own intent cannot see a broken intent.**
`measure-cut` therefore also fails on an unfittable gap: a layout can be
faithfully rendered and still be wrong.
