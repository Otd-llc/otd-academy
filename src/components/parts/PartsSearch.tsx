// src/components/parts/PartsSearch.tsx
"use client";
// Debounced search box for the parts list. Pushes `?q=` (resetting pagination) via
// router.replace so the Server Component re-queries; other params are preserved by
// partsHref. Empty input clears the q param. Controlled input reconciled to the URL
// so Back/Forward (and filter/pagination nav) never leave stale text in the box.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { partsHref } from "@/lib/parts-list-url";

export function PartsSearch({
  initialQ,
  current,
}: {
  initialQ: string;
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);
  const [, startTransition] = useTransition();

  // Reflect external URL changes (Back/Forward, filter/pagination nav) back into the
  // box so it never shows stale text relative to the list.
  useEffect(() => {
    setValue(initialQ);
  }, [initialQ]);

  // Debounce: push `q` to the URL when the box diverges from it. Comparing the trimmed
  // value against `initialQ` (the URL's current, schema-trimmed q) both skips firing on
  // mount and suppresses the redundant replace right after an external sync. `current`
  // is read from the latest render on purpose — a q-edit always drops `page`.
  useEffect(() => {
    const q = value.trim();
    if (q === initialQ) return; // already in sync with the URL
    const id = setTimeout(() => {
      startTransition(() =>
        router.replace(partsHref(current, { q: q || undefined }), { scroll: false }),
      );
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initialQ]);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search MPN, manufacturer, description…"
      aria-label="Search parts"
      className="mt-6 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
    />
  );
}
