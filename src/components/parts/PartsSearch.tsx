// src/components/parts/PartsSearch.tsx
"use client";
// Debounced search box for the parts list. Pushes `?q=` (resetting pagination) via
// router.replace so the Server Component re-queries; other params are preserved by
// partsHref. Empty input clears the q param.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; } // don't fire on mount
    const id = setTimeout(() => {
      startTransition(() => router.replace(partsHref(current, { q: value.trim() || undefined })));
    }, 250);
    return () => clearTimeout(id);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="search"
      defaultValue={initialQ}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search MPN, manufacturer, description…"
      aria-label="Search parts"
      className="mt-6 w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-link-muted focus:border-command-gold focus:outline-none"
    />
  );
}
