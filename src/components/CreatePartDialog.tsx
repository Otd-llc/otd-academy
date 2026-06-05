"use client";

// Inline "Create new Part" modal (design §9.1, reachable from the BOM
// editor). Backed by a native <dialog> element so we get the platform
// modality + ESC-to-close behavior. Submission calls createPartFormAction;
// on success we close the dialog and emit the new part to the parent so
// the BomLine dropdown can refresh without a navigation.
//
// The same form is also reachable as the full page /parts/new (per §9
// routes table).
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createPartFormAction,
  getCategoryDefaults,
  type PartFormState,
} from "@/lib/actions/parts";
import { getKicadSymbolMeta } from "@/lib/actions/kicad-search";
import { CategoryCombobox } from "@/components/parts/CategoryCombobox";
import { KicadLibPicker } from "@/components/parts/KicadLibPicker";
import { InlineBanner } from "@/components/InlineBanner";
import { Tooltip } from "@/components/Tooltip";

export type PartOption = {
  id: string;
  mpn: string;
  manufacturer: string;
};

const initialState: PartFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-command-gold bg-navy-dark px-4 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-50"
    >
      {pending ? "WORKING…" : "Create part"}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p className="mt-1 font-mono text-xs font-bold text-alert-red">
      {messages.join("; ")}
    </p>
  );
}

export function CreatePartDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: PartOption) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(createPartFormAction, initialState);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // When the action succeeds, emit upstream and close. Run via effect so we
  // don't mutate state during render.
  useEffect(() => {
    if (state.created) {
      onCreated?.(state.created);
    }
  }, [state.created, onCreated]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="w-full max-w-xl rounded border border-panel-border bg-navy-dark p-6 text-link-muted backdrop:bg-deep-space/80"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl tracking-wider text-white">
          NEW PART
        </h2>
        <form method="dialog">
          <button
            type="submit"
            aria-label="Close"
            className="rounded border border-panel-border bg-deep-space px-2 py-1 font-mono text-xs uppercase tracking-wider text-link-muted hover:border-command-gold"
          >
            ✕
          </button>
        </form>
      </div>

      {/* Pass the open <dialog> element as the tooltip portal container so
          in-dialog hints (e.g. isCertifiedModule) render inside the top layer
          rather than behind the modal backdrop (design §6 in-dialog note). By
          the time the user can hover a field the dialog is open and `ref.current`
          is populated; /parts/new omits this and portals to body. */}
      <PartFields
        state={state}
        action={action}
        tooltipContainer={ref.current}
      />
    </dialog>
  );
}

// Shared form body — used by both the modal here and /parts/new.
export function PartFields({
  state,
  action,
  tooltipContainer,
}: {
  state: PartFormState;
  action: (formData: FormData) => void | Promise<void>;
  /**
   * Portal container for in-form tooltips. The modal passes its open <dialog>
   * element so hints render inside the top layer; /parts/new omits it so they
   * portal to document.body. (Tooltip coerces null → undefined.)
   */
  tooltipContainer?: HTMLElement | null;
}) {
  // Auto-suggest (Phase C): on category select, prefill the KiCad symbol and
  // constrain the footprint picker. `currentSymbol` (controlled) is set by the
  // category default OR a manual pick; the selected symbol's fp-filters then
  // narrow the footprint picker.
  const [currentSymbol, setCurrentSymbol] = useState<string | null>(null);
  const [defaultFootprintLib, setDefaultFootprintLib] = useState<string | null>(null);
  const [symbolFpFilters, setSymbolFpFilters] = useState<string | null>(null);
  const [symbolDatasheet, setSymbolDatasheet] = useState<string | null>(null);
  // Controlled so the "use the symbol's datasheet" offer can fill it.
  const [datasheetUrl, setDatasheetUrl] = useState("");

  async function onCategorySelect(id: string | null) {
    if (!id) {
      setCurrentSymbol(null);
      setDefaultFootprintLib(null);
      return;
    }
    const d = await getCategoryDefaults(id);
    setCurrentSymbol(d?.defaultKicadSymbol ?? null);
    setDefaultFootprintLib(d?.defaultKicadFootprintLib ?? null);
  }

  // Fetch the selected symbol's metadata whenever it changes (auto-suggest or
  // manual pick): fp-filters narrow the footprint picker; the datasheet powers
  // the fill-datasheet offer below.
  useEffect(() => {
    let active = true;
    if (!currentSymbol) {
      setSymbolFpFilters(null);
      setSymbolDatasheet(null);
      return;
    }
    getKicadSymbolMeta(currentSymbol)
      .then((m) => {
        if (active) {
          setSymbolFpFilters(m.fpFilters);
          setSymbolDatasheet(m.datasheet);
        }
      })
      .catch(() => {
        if (active) {
          setSymbolFpFilters(null);
          setSymbolDatasheet(null);
        }
      });
    return () => {
      active = false;
    };
  }, [currentSymbol]);

  return (
    <form action={action} className="mt-4 space-y-4">
      {state.message && (
        <InlineBanner variant="error">{state.message}</InlineBanner>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Manufacturer
          </label>
          <input
            name="manufacturer"
            required
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.manufacturer} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            MPN
          </label>
          <input
            name="mpn"
            required
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.mpn} />
        </div>
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Description
        </label>
        <input
          name="description"
          required
          maxLength={500}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Category tree picker (Phase B): a searchable combobox posting
            `categoryId`. Replaces the flat PartCategory <select>; an empty
            selection leaves the part uncategorized. */}
        <CategoryCombobox
          error={state.errors?.categoryId}
          onSelect={onCategorySelect}
        />
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Footprint (optional)
          </label>
          <input
            name="footprint"
            maxLength={128}
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          />
          <FieldError messages={state.errors?.footprint} />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-wider text-muted">
            Lifecycle
          </label>
          <select
            name="lifecycle"
            defaultValue="ACTIVE"
            className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="NRND">NRND</option>
            <option value="EOL">EOL</option>
            <option value="OBSOLETE">OBSOLETE</option>
          </select>
          <FieldError messages={state.errors?.lifecycle} />
        </div>
      </div>

      {/* KiCad standard-library pickers (Phase C): server-search typeahead,
          auto-suggested from the chosen category's defaults; post the
          kicadSymbol / kicadFootprint lib-ids. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KicadLibPicker
          kind="symbol"
          name="kicadSymbol"
          label="KiCad symbol (optional)"
          value={currentSymbol}
          onSelect={setCurrentSymbol}
          error={state.errors?.kicadSymbol}
        />
        <KicadLibPicker
          kind="footprint"
          name="kicadFootprint"
          label="KiCad footprint (optional)"
          lib={defaultFootprintLib}
          fpFilters={symbolFpFilters}
          error={state.errors?.kicadFootprint}
        />
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Datasheet URL (optional)
        </label>
        <input
          name="datasheetUrl"
          type="url"
          value={datasheetUrl}
          onChange={(e) => setDatasheetUrl(e.target.value)}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        {/* Offer the selected symbol's datasheet when the field is empty
            (Phase C follow-up). Only for http(s) URLs; never overwrites a value
            the user already typed. */}
        {symbolDatasheet &&
        /^https?:\/\//i.test(symbolDatasheet) &&
        datasheetUrl.trim() === "" ? (
          <button
            type="button"
            onClick={() => setDatasheetUrl(symbolDatasheet)}
            className="mt-1 font-mono text-xs text-signal-blue hover:underline"
          >
            ↳ Use the symbol&apos;s datasheet
          </button>
        ) : null}
        <FieldError messages={state.errors?.datasheetUrl} />
      </div>

      {/* m18: isCertifiedModule marks the part as fulfilling the
          BOM_SOURCING mains-net certified-module gate when the parent
          Project has `hasMainsNet === true` (proposal §3 #5). */}
      <div>
        <Tooltip
          content="Marks this part as fulfilling the mains-net certified-module gate"
          container={tooltipContainer}
        >
          <label className="inline-flex items-center gap-2">
            <input
              name="isCertifiedModule"
              type="checkbox"
            />
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              Certified module (fulfills mains-net BOM gate)
            </span>
          </label>
        </Tooltip>
        <FieldError messages={state.errors?.isCertifiedModule} />
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-wider text-muted">
          Notes (optional)
        </label>
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-serif text-base text-link-muted focus:border-command-gold focus:outline-none"
        />
        <FieldError messages={state.errors?.notes} />
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
