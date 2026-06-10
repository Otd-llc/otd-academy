// KiCad project config (`.kicad_pro`) generation (export-engine Task 5, design §3.2).
//
// PURE (no React/DB/env/network/fs). Produces the `.kicad_pro` JSON file from a
// learner-friendly default board config, with overridable fields. `.kicad_pro`
// is JSON (NOT S-expression), so this module templates a plain object and
// JSON.stringify's it with stable key order + 2-space indent so OUR output is
// deterministic and diffs cleanly at manual acceptance.
//
// Target format KiCad 10. We cannot run KiCad here; the JSON shape below is
// based on the documented `.kicad_pro` structure (a stable superset shared
// across KiCad 7–10: `meta`, `board`, `net_settings`, `pcbnew`, `libraries`).
// Key FIDELITY ASSUMPTIONS for manual acceptance are flagged inline.
//
// Units: KiCad stores board lengths in MILLIMETRES throughout `.kicad_pro`.

// ── Board config (typed, learner-friendly defaults, overridable) ────────────

/**
 * A single net class. Track width / clearance / via sizes are in millimetres.
 * `name` is the KiCad net-class name ("Default", "Power", …).
 */
export type NetClassConfig = {
  name: string;
  /** Default trace width for nets in this class (mm). */
  trackWidth: number;
  /** Minimum copper-to-copper clearance (mm). */
  clearance: number;
  /** Via outer diameter (mm). */
  viaDiameter: number;
  /** Via drill diameter (mm). */
  viaDrill: number;
  /** Net names assigned to this class (e.g. ["+3V3", "+5V", "GND"]). */
  nets: string[];
};

/**
 * The board-level configuration that seeds the `.kicad_pro`. v1 ships ONE
 * sensible learner-friendly default (2-layer, 1 oz copper, generous hand-solder
 * clearances) with every field overridable via `Partial<BoardConfig>`.
 */
export type BoardConfig = {
  /** Number of copper layers (2 = top + bottom). */
  copperLayers: number;
  /** Copper weight in ounces (informational; drives stackup thickness notes). */
  copperWeightOz: number;
  /** Global minimum clearance (mm) — the design-rule floor. */
  minClearance: number;
  /** Global minimum track width (mm) — the design-rule floor. */
  minTrackWidth: number;
  /** Global minimum through-hole / via drill (mm). */
  minViaDrill: number;
  /** Global minimum annular ring width (mm). */
  minViaAnnularWidth: number;
  /** Net classes. The first MUST be the "Default" class. */
  netClasses: NetClassConfig[];
};

/**
 * Resolved learner-friendly defaults. Exposed so other export tasks (placement,
 * pcb, schematic) can read the same track/clearance numbers without re-deriving
 * them. Hand-solder friendly: wide tracks, generous clearance, a wider Power
 * class so rails carry current and tolerate sloppy hand routing.
 *
 *  - 2-layer, 1 oz copper.
 *  - Default class: 0.25 mm track, 0.2 mm clearance (comfortable for a
 *    beginner reflow/hand-solder board at typical fab minimums).
 *  - Power class: 0.5 mm track, 0.25 mm clearance (2x the Default track so
 *    rails carry more current and are easier to probe/rework).
 */
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  copperLayers: 2,
  copperWeightOz: 1,
  minClearance: 0.2,
  minTrackWidth: 0.2,
  minViaDrill: 0.3,
  minViaAnnularWidth: 0.13,
  netClasses: [
    {
      name: "Default",
      trackWidth: 0.25,
      clearance: 0.2,
      viaDiameter: 0.8,
      viaDrill: 0.4,
      nets: [],
    },
    {
      name: "Power",
      trackWidth: 0.5,
      clearance: 0.25,
      viaDiameter: 1.0,
      viaDrill: 0.5,
      nets: ["+3V3", "+5V", "GND"],
    },
  ],
};

/**
 * Merge a partial override onto the defaults. `netClasses` is replaced wholesale
 * when supplied (so a caller can fully control the class list) — otherwise the
 * default Default+Power pair stands.
 */
export function resolveBoardConfig(config?: Partial<BoardConfig>): BoardConfig {
  return {
    ...DEFAULT_BOARD_CONFIG,
    ...config,
    netClasses: config?.netClasses ?? DEFAULT_BOARD_CONFIG.netClasses,
  };
}

// ── `.kicad_pro` builder ────────────────────────────────────────────────────

export type BuildKicadProOpts = {
  /** Project base name (the `<project>` stem; also written into `meta.filename`). */
  projectName: string;
  /** Board-config overrides; omitted fields fall back to DEFAULT_BOARD_CONFIG. */
  config?: Partial<BoardConfig>;
};

/**
 * Build the `.kicad_pro` JSON body (pretty-printed, 2-space indent, stable key
 * order, one trailing newline). Includes the minimal-but-valid section set:
 *   - `meta`       — schema version + filename.
 *   - `board`      — design_settings (rule floors) + per-net-class design rules.
 *   - `libraries`  — project-local sym/fp lib nicknames (match the lib-tables).
 *   - `net_settings` — the net classes + their net→class membership.
 *   - `pcbnew`     — last_paths (3D model search path) so models resolve.
 *   - `schematic`/`sheets`/`text_variables` — empty stubs KiCad expects to find.
 *
 * The library nickname defaults to `projectName` to match Task 4's lib-tables
 * (which key `<nick>:<item>` off the project slug). Callers can pass an explicit
 * nickname via `config` is NOT supported — the nickname is the project name.
 */
export function buildKicadPro(opts: BuildKicadProOpts): string {
  const { projectName } = opts;
  const cfg = resolveBoardConfig(opts.config);

  // KiCad's net_settings.classes carry the human-facing class definitions;
  // board.design_settings.rules carries the global rule floor. We mirror the
  // class track/clearance into net_settings (where KiCad actually reads them).
  const netClasses = cfg.netClasses.map((nc) => ({
    name: nc.name,
    // KiCad colours/options we leave at neutral defaults.
    bus_width: 12,
    clearance: nc.clearance,
    diff_pair_gap: 0.25,
    diff_pair_via_gap: 0.25,
    diff_pair_width: 0.2,
    line_style: 0,
    microvia_diameter: 0.3,
    microvia_drill: 0.1,
    nets: nc.nets,
    pcb_color: "rgba(0, 0, 0, 0.000)",
    schematic_color: "rgba(0, 0, 0, 0.000)",
    track_width: nc.trackWidth,
    via_diameter: nc.viaDiameter,
    via_drill: nc.viaDrill,
    wire_width: 6,
  }));

  // Flatten net→class assignment (KiCad 8+ keeps an explicit map alongside the
  // per-class `nets` arrays). Default class needs no explicit assignment.
  const netClassAssignments: Record<string, string> = {};
  for (const nc of cfg.netClasses) {
    if (nc.name === "Default") continue;
    for (const net of nc.nets) netClassAssignments[net] = nc.name;
  }

  const pro = {
    board: {
      design_settings: {
        defaults: {
          // Board-default trace/via taken from the Default net class.
          board_outline_line_width: 0.1,
          copper_line_width: 0.2,
          copper_text_italic: false,
          copper_text_size_h: 1.5,
          copper_text_size_v: 1.5,
          copper_text_thickness: 0.3,
          copper_text_upright: false,
          courtyard_line_width: 0.05,
          dimension_precision: 4,
          dimension_units: 3,
          other_line_width: 0.1,
          silk_line_width: 0.1,
          silk_text_italic: false,
          silk_text_size_h: 1.0,
          silk_text_size_v: 1.0,
          silk_text_thickness: 0.1,
          silk_text_upright: false,
        },
        rules: {
          max_error: 0.005,
          min_clearance: cfg.minClearance,
          min_copper_edge_clearance: 0.5,
          min_hole_clearance: 0.25,
          min_hole_to_hole: 0.25,
          min_microvia_diameter: 0.2,
          min_microvia_drill: 0.1,
          min_resolved_spokes: 2,
          min_silk_clearance: 0.0,
          min_text_height: 0.8,
          min_text_thickness: 0.08,
          min_through_hole_diameter: 0.3,
          min_track_width: cfg.minTrackWidth,
          min_via_annular_width: cfg.minViaAnnularWidth,
          min_via_diameter: 0.5,
          solder_mask_to_copper_clearance: 0.0,
          use_height_for_length_calcs: true,
        },
        // Track widths / via dimensions offered in the pcbnew dropdowns; index
        // 0 (the "use net class value" entry) plus the Default + Power widths.
        track_widths: [0.0, cfg.minTrackWidth, ...cfg.netClasses.map((n) => n.trackWidth)],
        via_dimensions: cfg.netClasses.map((n) => ({
          diameter: n.viaDiameter,
          drill: n.viaDrill,
        })),
      },
      layer_presets: [],
      viewports: [],
    },
    boards: [],
    cvpcb: {
      equivalence_files: [],
    },
    erc: {
      // The schematic embeds flattened copies of standard-library symbols
      // (Device:LED, USBLC6, …) in lib_symbols, and we un-hide some pin names —
      // so an embedded def intentionally differs from the user's stock library.
      // Silence the "symbol doesn't match library" ERC nag that would otherwise
      // fire on every referenced symbol; it isn't a real wiring error.
      rule_severities: {
        lib_symbol_mismatch: "ignore",
      },
    },
    libraries: {
      // Project-local libraries — nickname == project name, matching the
      // sym-lib-table / fp-lib-table rows Task 4 emits.
      pinned_footprint_libs: [projectName],
      pinned_symbol_libs: [projectName],
    },
    meta: {
      filename: `${projectName}.kicad_pro`,
      version: 3,
    },
    net_settings: {
      classes: netClasses,
      meta: {
        version: 4,
      },
      net_colors: null,
      netclass_assignments: netClassAssignments,
      netclass_patterns: [],
    },
    pcbnew: {
      last_paths: {
        gencad: "",
        idf: "",
        netlist: "",
        plot: "",
        pos_files: "",
        specctra_dsn: "",
        step: "",
        svg: "",
        vrml: "",
      },
      // 3D model search path — bundled models live under the project dir.
      page_layout_descr_file: "",
    },
    schematic: {
      legacy_lib_dir: "",
      legacy_lib_list: [],
    },
    sheets: [],
    text_variables: {},
  };

  return JSON.stringify(pro, null, 2) + "\n";
}
