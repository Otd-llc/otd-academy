"use client";

// Searchable category picker for the create form (Phase B). A client island
// over the server-fetched category tree (listCategoriesForPicker), showing each
// node as a breadcrumb of names ("Passives › Capacitors › MLCC Capacitors").
// The selection posts via a hidden <input name="categoryId">; an empty value
// means "no category" (the part is created uncategorized).
//
// Reuses the app's existing form-field look. Filtering is a plain substring
// match over the label; the list is tiny so no virtualization is needed.
import { useEffect, useId, useState } from "react";

import { listCategoriesForPicker } from "@/lib/actions/parts";

type Option = { id: string; label: string; path: string };

export function CategoryCombobox({
  name = "categoryId",
  error,
}: {
  name?: string;
  error?: string[];
}) {
  const [options, setOptions] = useState<Option[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selected, setSelected] = useState<Option | null>(null);
  const [open, setOpen] = useState(false);
  const listId = useId();

  useEffect(() => {
    let active = true;
    listCategoriesForPicker()
      .then((opts) => {
        if (active) {
          setOptions(opts);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Non-fatal: the field degrades to "no categories" — the part can still
        // be created uncategorized. `loaded` flips so the list shows the empty
        // state rather than a permanent "Loading…".
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Always filter by the typed text (a prior selection does NOT suppress it),
  // so re-opening and typing narrows the list.
  const filter = inputValue.trim().toLowerCase();
  const filtered =
    filter === ""
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(filter));

  function choose(o: Option) {
    setSelected(o);
    setInputValue(o.label);
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    setInputValue("");
  }

  return (
    <div>
      <label className="block font-mono text-xs uppercase tracking-wider text-muted">
        Category (optional)
      </label>
      <div className="relative mt-1">
        {/* The posted value: the selected category id, or "" for none. */}
        <input type="hidden" name={name} value={selected?.id ?? ""} />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search categories…"
          value={inputValue}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSelected(null);
            setInputValue(e.target.value);
            setOpen(true);
          }}
          // Delay close so an option's onClick fires before blur hides the list.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          className="w-full rounded border border-panel-border bg-deep-space px-2 py-2 pr-7 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
        />
        {selected || inputValue ? (
          <button
            type="button"
            aria-label="Clear category"
            // preventDefault so the mousedown doesn't blur the input (and arm the
            // close timer) before the click registers — matches the option rows.
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute inset-y-0 right-1 my-auto h-5 w-5 rounded font-mono text-xs text-muted hover:text-command-gold"
          >
            ✕
          </button>
        ) : null}

        {open ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded border border-panel-border bg-navy-dark py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-1 font-mono text-xs text-muted">
                {options.length === 0
                  ? loaded
                    ? "No categories available"
                    : "Loading…"
                  : "No matches"}
              </li>
            ) : (
              filtered.map((o) => (
                <li key={o.id} role="option" aria-selected={selected?.id === o.id}>
                  <button
                    type="button"
                    // preventDefault on mousedown so the input's blur doesn't
                    // close the list before this click registers.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                    className="block w-full px-2 py-1 text-left font-mono text-xs text-link-muted hover:bg-deep-space hover:text-command-gold"
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {error && error.length > 0 ? (
        <p className="mt-1 font-mono text-xs font-bold text-alert-red">
          {error.join("; ")}
        </p>
      ) : null}
    </div>
  );
}
