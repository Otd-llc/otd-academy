"use client";

// One fact-group card on the part detail page (design §6 / Task 7a). The
// curate → verify → view surface for a single PartFactGroup.
//
// VIEW mode renders: the group label + a VerifyBadge (trust state), and — when
// `canEdit` — the gate controls (Edit pencil; Verify / Flag / Clear-flag
// IconButtons). Each gate control dispatches its `*-form.ts` wrapper via
// useTransition carrying the loaded `updatedAt` (the optimistic-lock fence); on
// success it `router.refresh()`es so the server re-reads the row. A `{message}`
// rejection — the per-`sourceKind` verify precondition, the duplicate-group
// guard, OR the "changed since you opened it — reload" optimistic-lock conflict
// — surfaces inline beneath the controls.
//
// EDIT mode renders the right per-type editor for the group + the shared
// ProvenanceFields + Save/Cancel. Save client-validates `data` against
// `factDataSchema(group, category)` (defense-in-depth; the server re-validates)
// then dispatches createFactForm (no existing row) or editFactForm (existing
// row, with `updatedAt`).
//
// A MISSING group (no row yet) renders an "Add <group>" affordance that drops
// straight into edit mode seeded with that group's empty `data`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import type {
  FactSourceKind,
  FactTrust,
  PartCategory,
  PartFactGroup,
} from "@prisma/client";

import { factDataSchema } from "@/lib/schemas/part-fact";
import type {
  Parametrics,
  Pinout,
  Power,
  Derating,
  Mechanical,
  Notes,
} from "@/lib/schemas/part-fact";
import {
  createFactForm,
  editFactForm,
  verifyFactForm,
  flagFactForm,
  clearFlagForm,
  type FactFormState,
} from "@/lib/actions/part-facts-form";
import { IconButton } from "@/components/IconButton";
import { PencilIcon, CheckIcon, AlertTriangleIcon, CloseIcon } from "@/components/icons";
import { VerifyBadge } from "@/components/parts/VerifyBadge";
import {
  ProvenanceFields,
  type ProvenanceValue,
  type DatasheetOption,
} from "@/components/parts/ProvenanceFields";
import { ParametricsEditor } from "@/components/parts/ParametricsEditor";
import { MechanicalEditor } from "@/components/parts/MechanicalEditor";
import { PowerEditor } from "@/components/parts/PowerEditor";
import { NotesEditor } from "@/components/parts/NotesEditor";
import { PinoutEditor } from "@/components/parts/PinoutEditor";
import { DeratingEditor } from "@/components/parts/DeratingEditor";
import {
  GROUP_LABELS,
  defaultFactData,
  type FactData,
} from "@/components/parts/fact-group-meta";

// Serialized existing fact (dates → ISO strings cross the server→client seam).
export type SerializedFact = {
  id: string;
  data: unknown;
  trust: FactTrust;
  sourceKind: FactSourceKind;
  partDatasheetId: string | null;
  sourcePage: number | null;
  sourceUrl: string | null;
  sourceNote: string | null;
  verifiedAt: string | null;
  verifierName: string | null;
  updatedAt: string;
};

export function FactGroupCard({
  partId,
  category,
  group,
  fact,
  canEdit,
  datasheet,
}: {
  partId: string;
  category: PartCategory | null;
  group: PartFactGroup;
  fact: SerializedFact | null;
  canEdit: boolean;
  datasheet?: DatasheetOption | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Inline error surfaced for any rejection (gate precondition, conflict,
  // duplicate-group) and per-field validation errors in edit mode.
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);

  // Edit drafts — seeded on entry from the existing fact (or the group's empty
  // default for a new fact).
  const [dataDraft, setDataDraft] = useState<FactData>(() =>
    defaultFactData(group),
  );
  const [prov, setProv] = useState<ProvenanceValue>({
    sourceKind: group === "NOTES" ? "MANUAL" : "DATASHEET",
  });

  const isNotes = group === "NOTES";

  function seedDrafts() {
    if (fact) {
      setDataDraft(fact.data as FactData);
      setProv({
        sourceKind: fact.sourceKind,
        partDatasheetId: fact.partDatasheetId ?? undefined,
        sourcePage: fact.sourcePage ?? undefined,
        sourceUrl: fact.sourceUrl ?? undefined,
        sourceNote: fact.sourceNote ?? undefined,
      });
    } else {
      setDataDraft(defaultFactData(group));
      setProv({ sourceKind: isNotes ? "MANUAL" : "DATASHEET" });
    }
  }

  function enterEdit() {
    seedDrafts();
    setError(null);
    setFieldErrors(undefined);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setFieldErrors(undefined);
    setEditing(false);
  }

  // BlockListEditor keys its errors under `contentBlocks.<i>`, but client
  // validation of NOTES `data` produces `blocks.<i>` paths — remap so the block
  // editor can surface them.
  function notesBlockErrors(): Record<string, string[]> | undefined {
    if (!isNotes || !fieldErrors) return fieldErrors;
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(fieldErrors)) {
      out[k.startsWith("blocks.") ? k.replace(/^blocks\./, "contentBlocks.") : k] = v;
    }
    return out;
  }

  function onDataChange(next: FactData) {
    // Clear stale (index-keyed) errors on every structural/content edit.
    setError(null);
    setFieldErrors(undefined);
    setDataDraft(next);
  }

  function save() {
    setError(null);
    setFieldErrors(undefined);

    // Client-validate `data` against the group/category schema (the server
    // re-validates regardless — defense-in-depth).
    const parsed = factDataSchema(group, category).safeParse(dataDraft);
    if (!parsed.success) {
      const errs: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_root";
        (errs[key] ??= []).push(issue.message);
      }
      setFieldErrors(errs);
      setError("Some fields are invalid — fix the highlighted fields.");
      return;
    }

    // Assemble the strict envelope. NOTES is forced MANUAL upstream.
    const provPayload = {
      sourceKind: isNotes ? ("MANUAL" as const) : prov.sourceKind,
      partDatasheetId: prov.partDatasheetId,
      sourcePage: prov.sourcePage,
      sourceUrl: prov.sourceUrl,
      sourceNote: prov.sourceNote,
    };

    startTransition(async () => {
      try {
        let r: FactFormState;
        if (fact) {
          r = await editFactForm({
            id: fact.id,
            updatedAt: fact.updatedAt,
            data: parsed.data,
            ...provPayload,
          });
        } else {
          r = await createFactForm({
            partId,
            group,
            data: parsed.data,
            ...provPayload,
          });
        }
        if (r.ok) {
          setEditing(false);
          router.refresh();
        } else {
          setError(r.message ?? "Could not save.");
          setFieldErrors(r.errors);
        }
      } catch {
        setError("Could not save — check your connection and try again.");
      }
    });
  }

  // ─── gate control dispatch (verify / flag / clearFlag) ──────────────────
  function runGate(
    wrapper: (input: unknown) => Promise<FactFormState>,
  ) {
    if (!fact) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await wrapper({ id: fact.id, updatedAt: fact.updatedAt });
        if (r.ok) {
          router.refresh();
        } else {
          setError(r.message ?? "Action failed.");
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Action failed — check your connection and try again.",
        );
      }
    });
  }

  const label = GROUP_LABELS[group];

  // ─── EDIT mode ──────────────────────────────────────────────────────────
  if (editing) {
    return (
      <section className="space-y-5 rounded border-t-2 border-command-gold bg-navy-dark/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl tracking-wider text-white">
            {label}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gold-dim">
            Editing
          </span>
        </div>

        <FactDataEditor
          group={group}
          data={dataDraft}
          onChange={onDataChange}
          notesErrors={notesBlockErrors()}
        />

        <ProvenanceFields
          value={prov}
          onChange={setProv}
          datasheet={datasheet}
          lockManual={isNotes}
          errors={fieldErrors}
        />

        {error ? (
          <p
            role="alert"
            className="rounded border border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm text-alert-red"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded border border-command-gold bg-command-gold px-3 py-2 font-mono text-xs uppercase tracking-wider text-deep-space transition-colors hover:border-gold-light hover:bg-gold-light disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-command-gold hover:text-command-gold disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  // ─── VIEW mode (existing fact) ──────────────────────────────────────────
  if (fact) {
    return (
      <section className="rounded border border-panel-border bg-navy-dark/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl tracking-wider text-white">
              {label}
            </h3>
            <VerifyBadge
              trust={fact.trust}
              verifierName={fact.verifierName}
              verifiedAt={fact.verifiedAt}
            />
          </div>

          {canEdit ? (
            <div className="flex items-center gap-1">
              <IconButton
                type="button"
                hint="Edit"
                ariaLabel={`Edit ${label}`}
                disabled={isPending}
                onClick={enterEdit}
              >
                <PencilIcon className="h-5 w-5" />
              </IconButton>

              {fact.trust !== "FLAGGED" ? (
                <IconButton
                  type="button"
                  hint="Verify"
                  ariaLabel={`Verify ${label}`}
                  disabled={isPending}
                  onClick={() => runGate(verifyFactForm)}
                >
                  <CheckIcon className="h-5 w-5" />
                </IconButton>
              ) : null}

              {fact.trust !== "FLAGGED" ? (
                <IconButton
                  type="button"
                  tone="danger"
                  hint="Flag"
                  ariaLabel={`Flag ${label}`}
                  disabled={isPending}
                  onClick={() => runGate(flagFactForm)}
                >
                  <AlertTriangleIcon className="h-5 w-5" />
                </IconButton>
              ) : (
                <IconButton
                  type="button"
                  hint="Clear flag"
                  ariaLabel={`Clear flag on ${label}`}
                  disabled={isPending}
                  onClick={() => runGate(clearFlagForm)}
                >
                  <CloseIcon className="h-5 w-5" />
                </IconButton>
              )}
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <FactSummary group={group} data={fact.data} />
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded border border-alert-red bg-navy-dark px-4 py-3 font-mono text-sm text-alert-red"
          >
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  // ─── VIEW mode (missing group → Add affordance) ─────────────────────────
  return (
    <section className="rounded border border-dashed border-panel-border bg-navy-dark/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xl tracking-wider text-muted">
            {label}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Not curated
          </span>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={enterEdit}
            className="inline-flex items-center gap-1.5 rounded border border-command-gold px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
          >
            Add {label}
          </button>
        ) : null}
      </div>
    </section>
  );
}

// ─── per-group editor dispatch ──────────────────────────────────────────────
function FactDataEditor({
  group,
  data,
  onChange,
  notesErrors,
}: {
  group: PartFactGroup;
  data: FactData;
  onChange: (next: FactData) => void;
  notesErrors?: Record<string, string[]>;
}) {
  // Each editor is typed to one member of the FactData union; the draft is the
  // matching member by construction (seeded from `defaultFactData(group)` or the
  // stored row of that group). We narrow with a single cast per arm — the
  // `onChange` widens back to FactData since every member is assignable to it.
  switch (group) {
    case "PARAMETRICS":
      return (
        <ParametricsEditor
          data={data as Parametrics}
          onChange={onChange}
        />
      );
    case "MECHANICAL":
      return (
        <MechanicalEditor
          data={data as Mechanical}
          onChange={onChange}
        />
      );
    case "POWER":
      return <PowerEditor data={data as Power} onChange={onChange} />;
    case "NOTES":
      return (
        <NotesEditor
          data={data as Notes}
          onChange={onChange}
          errors={notesErrors}
        />
      );
    case "PINOUT":
      return <PinoutEditor data={data as Pinout} />;
    case "DERATING":
      return <DeratingEditor data={data as Derating} />;
    default: {
      const _exhaustive: never = group;
      return <p className="text-alert-red">Unknown group: {String(_exhaustive)}</p>;
    }
  }
}

// ─── compact read-only summary (view mode) ──────────────────────────────────
// A minimal, type-agnostic projection so a curated fact is legible at a glance.
// The rich per-type read views (pinout table, derating sparkline) arrive with
// the quick-glance modal (Task 8); here we keep it simple and robust.
function FactSummary({
  group,
  data,
}: {
  group: PartFactGroup;
  data: unknown;
}) {
  const d = (data ?? {}) as Record<string, unknown>;

  function rows(): { k: string; v: string }[] {
    switch (group) {
      case "PARAMETRICS":
      case "MECHANICAL": {
        const entries = Array.isArray(d.entries) ? d.entries : [];
        return entries.map((e) => {
          const row = e as Record<string, unknown>;
          const unit = row.unit ? ` ${String(row.unit)}` : "";
          return {
            k: String(row.label ?? ""),
            v: `${String(row.value ?? "")}${unit}`,
          };
        });
      }
      case "POWER": {
        const bypass = Array.isArray(d.bypass) ? d.bypass : [];
        return bypass.map((b, i) => {
          const row = b as Record<string, unknown>;
          return {
            k: `bypass ${i + 1}`,
            v: `${String(row.value ?? "")} @ ${String(row.placement ?? "")}`,
          };
        });
      }
      case "PINOUT": {
        const pins = Array.isArray(d.pins) ? d.pins : [];
        return [{ k: "pins", v: String(pins.length) }];
      }
      case "DERATING": {
        const curves = Array.isArray(d.curves) ? d.curves : [];
        return [{ k: "curves", v: String(curves.length) }];
      }
      case "NOTES": {
        const blocks = Array.isArray(d.blocks) ? d.blocks : [];
        return [{ k: "blocks", v: String(blocks.length) }];
      }
      default:
        return [];
    }
  }

  const list = rows();
  if (list.length === 0) {
    return (
      <p className="font-mono text-xs text-muted">No content.</p>
    );
  }
  return (
    <dl className="grid grid-cols-1 gap-1 font-mono text-sm sm:grid-cols-2">
      {list.map((r, i) => (
        <div key={i} className="flex gap-2">
          <dt className="text-muted">{r.k}</dt>
          <dd className="text-link-muted">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}
