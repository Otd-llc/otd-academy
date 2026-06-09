# OTD Academy — Reference-CAD Delivery + SCHEMATIC Verification (Design)

_2026-06-09. Engineering design for two interlocking curriculum-build mechanisms, plus
the validated L1.02 board design that consumes them. Emerged from a brainstorming session.
Companion (business layer) is the gitignored `2026-06-09-public-narrative-skill-tree.md`._

## 1. Context & scope

The platform teaches PCB design across 8 stage-gated phases (`src/lib/stages.ts`). Two gaps
surfaced while planning the "finish Level 1" work:

- **The SCHEMATIC gate verifies nothing.** It checks only "an artifact exists at this stage
  + `schematicCommit` pinned" ([stages.ts:202](../../src/lib/stages.ts)) — a learner can
  advance with a blank file.
- **No per-phase reference design** exists for students to verify against, and the
  **KiCad-export download button is hand-authored on L1.01 only** (in
  `scripts/rewrite-wroom-guide.ts`), not on the other 21 projects. The SCHEMATIC stage
  *skeleton* has only a prose line telling the student to "open the provided KiCad files."

This doc designs **(A)** a reference-CAD-per-phase model (the "answer key" every project
ships), **(B)** a SCHEMATIC-phase redesign (templated download, reference image,
completed-project reveal, and a gate that means something), and records **(C)** the
validated L1.02 ESP-NOW board design — the first project to be built on these rails.

Out of scope: business/monetization narrative (see the gitignored GTM doc).

## 2. Reference-CAD per phase (the "answer key")

Each project ships an author reference design attached to its **published revision** as
`Artifact` rows with `enrollmentId = null` ([schema.prisma:262](../../prisma/schema.prisma));
a learner's own uploads attach to *their* `Enrollment`. At each gate the student compares
their work to the reference.

**Key distinction:** stages 1–5 are **revision-scoped** (the real CAD files a student diffs
against); stages 6–8 (ORDERING/ASSEMBLY/BRINGUP) are **Build-scoped** (a physical
fabrication run) → the reference there is **procedures + expected results**, not CAD files.

| Phase | Reference artifact (subkind) | Deliverable |
|---|---|---|
| 1 REQUIREMENTS | `REQUIREMENTS_DOC` | Spec sheet: interfaces, power budget, mechanical, target cost |
| 2 BOM_SOURCING | `BOM_EXPORT` | Finalized BOM CSV/PDF (in-DB BomLines + export) |
| 3 SCHEMATIC | `SCHEMATIC_FILE` (record) + **`ERC_REPORT`** (gate) | `.kicad_sch` + schematic PDF + clean ERC |
| 4 LAYOUT | `LAYOUT_FILE` + `MODEL_3D` | `.kicad_pcb` + board 3D (.glb) + top/bottom renders |
| 5 DRC_GERBER | `DRC_REPORT` + `GERBER_ZIP` | Clean DRC + Gerbers incl. drill |
| 6 ORDERING | `PCB_ORDER`, `PARTS_ORDER`, `BOM_CSV_AS_ORDERED` | Fab order spec (stackup/finish) + BOM-as-ordered |
| 7 ASSEMBLY | `ASSEMBLY_PROCEDURE` + `POST_ASSEMBLY_CONTINUITY` | Assembly drawing / placement map + iBOM + continuity points |
| 8 BRINGUP | `BENCH_PROCEDURE` + `BRINGUP_LOG` | Bring-up procedure + expected-measurement table + test firmware |

**Plus, per project:** the **KiCad project source** and **two custom library parts** — a
symbol+footprint for the **WROOM module (U1)** and the **USB-C connector (J1)**, confirmed
the only two BOM parts lacking standard KiCad refs (everything else has symbol+footprint).
Also: schematic PDF, board 3D `.glb`, interactive HTML BOM (iBOM), pick-and-place/centroid,
drill map, and bring-up firmware + expected readings.

**Division of labor:** the KiCad files (schematic/layout/gerbers/DRC/3D/iBOM/CPL/custom
symbols) are the author's CAD work (can't be generated headlessly). The non-CAD reference
set (requirements doc, BOM CSV, procedures, expected-measurements, firmware) can be authored
and attached programmatically.

## 3. SCHEMATIC phase redesign

### 3.1 Templated KiCad-export download (all 22 projects)
Move the export action **into the SCHEMATIC stage skeleton** (`stage-skeletons.ts`) so
`composeGuide` emits it for every project, instead of hand-placing it per guide.
`buildKicadExportZip(revisionId)` is already generic (BOM-driven; produces the **unwired
starter** — placed parts with footprints/3D/datasheets). Render conditionally on a frozen
BOM (else show "BOM not finalized yet").

### 3.2 Reference schematic image
Embed a rendered reference schematic (PNG/SVG of the author `.kicad_sch`) as an **image
block** in the SCHEMATIC card — the visual answer key. Per project; no gate logic needed.

### 3.3 Completed-project reveal
Offer the fully-wired reference project as a **solution download** (after-attempt reveal, or
simply available — "files openly shipped" is the accepted GTM stance). Requires the author
CAD.

### 3.4 The gate: clean ERC now, netlist comparison later  **[DECIDED]**
- Replace the meaningless "schematic file present" criterion with a **clean `ERC_REPORT`**
  requirement — mirroring how DRC_GERBER gates on a clean DRC. The schematic *file* stays as
  an attached **record**, not the gate criterion.
- ERC verifies **coherence** (every pin connected, no conflicts) — *not* correctness vs. the
  intended design (a different-but-valid circuit can pass ERC). The funded follow-up is
  **netlist-equivalence comparison** (parse the student's exported netlist, compare net/pin
  sets to the reference netlist) — the true "your wiring matches the design" check, and
  automatable because the parts/refdes are locked.
- This makes the verification spine **symmetric**: SCHEMATIC → clean ERC · LAYOUT → review
  checklist · DRC_GERBER → clean DRC.
- **Reconsider `schematicCommit`-pinned for learners** — a git-workflow artifact; fine for
  the author build, friction for a learner not using git.

### 3.5 Implementation notes
- `ERC_REPORT` added to the `ArtifactSubkind` enum → Prisma migration → **full `tsc` +
  vitest** (schema-change rule). Add to SCHEMATIC `revisionAllowedArtifactSubkinds` +
  `defaultRevisionArtifactSubkind`; update the SCHEMATIC `exitGate` to require it.
- Templated action block in `STAGE_CARD_SKELETONS.SCHEMATIC.baseBlocks`; conditional render
  in the guide route / `GuideBlocks.tsx`.
- Netlist comparison is a separate, larger build (netlist parser + equivalence algorithm +
  a stored reference netlist per project).

## 4. L1.02 ESP-NOW node — validated board design

The first project built on these rails. Decisions from the brainstorm + a validation pass
(all six load-bearing claims verified against Espressif docs + the repo):

- **Board:** a "minimal ESP-NOW node," built as a **pair**. It is L1.01's core
  (WROOM-1 **native-USB** + USB-C + ESD + polyfuse + LDO + decoupling + EN/BOOT) **minus**
  the 1×40 GPIO breakaway headers (J2/J3), **plus** one user button (TX trigger). The RX
  indicator **reuses L1.01's existing user LED (LED2 + R6)**. Internal PCB antenna →
  **antenna keep-out is the hardware centerpiece**.
- **Programming:** reuse L1.01's **native USB** (ESP32-S3 USB-Serial-JTAG; D−=GPIO19,
  D+=GPIO20; hold BOOT + tap RESET for download mode). **No USB-UART bridge, no
  auto-program transistors** — L1.01 has neither (its `disciplineTaught` text is stale).
- **User button → GPIO4** (RTC + ADC1, no special role). Avoids strapping pins
  (GPIO0/3/45/46), USB (19/20), UART0 (43/44).
- **BOM delta: zero new part *types*.** Every L1.02 part is an existing L1.01 MPN
  (drop J2/J3; bump B3F-1000 qty 2→3 for the user button). All parts already have KiCad
  symbol/footprint (except U1/J1, which have uploaded assets) + 3D renders → **no new
  parts/KiCad/3D seeding**; only the new revision's BOM lines.
- **Content strategy:** condense the shared subsystems (recap + link to L1.01) and go deep
  on the new material — ESP-NOW protocol (pairing/channels/peers), antenna keep-out,
  button/LED I/O, build-a-pair/role-flash workflow. The DAG already requires L1.01 first.
- **Firmware (the payoff):** ship minimal **TX + RX ESP-NOW sketches**; "role flashing" =
  flash TX to node A, RX to node B; press the button on A → user LED lights on B.
- **`requiresStripboard: true`** → the BOM_SOURCING gate also requires a
  `STRIPBOARD_VALIDATION` checklist (unlike L1.01, which is `false`).
- Teachable tie-in: GPIO11–20 are ADC2 (unusable while WiFi/ESP-NOW active) — a clean
  callback to L1.05's ADC1-only lesson (moot for a digital button, but worth a callout).

## 5. Workstreams & sequencing

1. **Platform mechanism (benefits all 22 projects) — do first:** templated download (3.1),
   reference image block (3.2), ERC gate (3.4). Branch + PR each; ERC needs `tsc` + vitest.
2. **L1.01 reference design (the exemplar):** author CAD (KiCad, you) **∥** the non-CAD
   reference set (me — requirements doc, BOM CSV, assembly + bring-up procedures,
   expected-measurement table, bring-up firmware). Drafts under
   `docs/reference-designs/l1-01-wroom-breakout/`.
3. **L1.02 build:** BOM seed (reuse existing parts) → flagship-parity content → reference
   CAD → publish.

## 6. Open items
- Netlist-comparison design (the rigorous SCHEMATIC correctness check) — later.
- Do LAYOUT/ASSEMBLY/BRINGUP get the same "completed reference + reveal" treatment?
  (LAYOUT/DRC are already rigorous via the review checklist + clean DRC.)
- `schematicCommit`-for-learner: drop from the learner gate?

## Appendix — grounding
- Gate model: `src/lib/stages.ts`; artifact taxonomy: `prisma/schema.prisma` (`ArtifactKind`,
  `ArtifactSubkind`).
- Guide template: `src/lib/guide-templates/{compose,stage-skeletons}.ts`; renderer:
  `src/components/guide/GuideBlocks.tsx`.
- KiCad export: `src/lib/kicad/export.ts` (`buildKicadExportZip`), `scripts/gen-kicad-export.ts`.
- L1.01 reference build scripts: `scripts/seed-wroom-s3-parts.ts`, `finalize-wroom-bom.ts`,
  `populate-wroom-kicad-refs.ts`, `rewrite-wroom-guide.ts`.
