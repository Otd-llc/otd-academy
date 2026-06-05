"use client";

// Searchable KiCad symbol/footprint picker for the create form (Phase C, Task 7).
//
// Unlike the Phase B CategoryCombobox (which loads all 14 rows once and filters
// client-side), the KiCad index is ~20k/15k rows, so this SEARCHES the server
// per keystroke: debounced ~200ms, with stale-response cancellation (a monotonic
// `seq` — only the latest response is applied, so a slow earlier query can't
// overwrite a newer one). Posts the chosen lib-id via a hidden input.
import { useEffect, useId, useRef, useState } from "react";

import {
  searchKicadSymbols,
  searchKicadFootprints,
  type KicadSymbolHit,
} from "@/lib/actions/kicad-search";

type Kind = "symbol" | "footprint";

export function KicadLibPicker({
  kind,
  name,
  label,
  lib,
  fpFilters,
  value,
  onSelect,
  error,
}: {
  kind: Kind;
  /** Hidden-input name: "kicadSymbol" | "kicadFootprint". */
  name: string;
  label: string;
  /** Optional lib filter (the category's default footprint lib). */
  lib?: string | null;
  /** Footprint kind only: the selected symbol's `ki_fp_filters` globs — narrows
   *  the results to footprints whose name matches. */
  fpFilters?: string | null;
  /** Controlled initial/auto-suggested lib-id (e.g. the category default symbol). */
  value?: string | null;
  /** Notified with the chosen lib-id (or null on clear). */
  onSelect?: (libId: string | null) => void;
  error?: string[];
}) {
  const [selected, setSelected] = useState<string | null>(value ?? null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<KicadSymbolHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const listId = useId();

  // Re-seed when the auto-suggested value changes (category select).
  useEffect(() => {
    setSelected(value ?? null);
  }, [value]);

  // Debounced server search, latest-response-wins.
  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) {
      setHits([]);
      setLoading(false);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      const search = kind === "symbol" ? searchKicadSymbols : searchKicadFootprints;
      search({ q: term, lib: lib ?? undefined, fpFilters: fpFilters ?? undefined, take: 20 })
        .then((r) => {
          if (mySeq === seq.current) {
            setHits(r);
            setLoading(false);
          }
        })
        .catch(() => {
          if (mySeq === seq.current) {
            setHits([]);
            setLoading(false);
          }
        });
    }, 200);
    return () => clearTimeout(t);
  }, [query, kind, lib, fpFilters]);

  function choose(libId: string) {
    setSelected(libId);
    setQuery("");
    setHits([]);
    setOpen(false);
    onSelect?.(libId);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setHits([]);
    onSelect?.(null);
  }

  return (
    <div>
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        {label}
      </label>
      <div className="relative mt-1">
        <input type="hidden" name={name} value={selected ?? ""} />

        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded border border-panel-border bg-deep-space px-2 py-2">
            <span className="truncate font-mono text-sm text-command-gold">{selected}</span>
            <button
              type="button"
              aria-label={`Clear ${label}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              className="shrink-0 font-mono text-xs text-muted hover:text-command-gold"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              placeholder={kind === "symbol" ? "Search symbols…" : "Search footprints…"}
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="w-full rounded border border-panel-border bg-deep-space px-2 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
            />
            {open && query.trim() ? (
              <ul
                id={listId}
                role="listbox"
                className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-panel-border bg-navy-dark py-1 shadow-lg"
              >
                {loading ? (
                  <li className="px-2 py-1 font-mono text-xs text-muted">Searching…</li>
                ) : hits.length === 0 ? (
                  <li className="px-2 py-1 font-mono text-xs text-muted">No matches</li>
                ) : (
                  hits.map((h) => (
                    <li key={h.libId} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(h.libId)}
                        className="block w-full px-2 py-1 text-left hover:bg-deep-space"
                      >
                        <span className="font-mono text-xs text-command-gold">{h.name}</span>
                        <span className="font-mono text-xs text-muted"> · {h.lib}</span>
                        {h.description ? (
                          <span className="block truncate font-mono text-[10px] text-muted">
                            {h.description}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </>
        )}
      </div>
      {error && error.length > 0 ? (
        <p className="mt-1 font-mono text-xs font-bold text-alert-red">
          {error.join("; ")}
        </p>
      ) : null}
    </div>
  );
}
