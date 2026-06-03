"use client";

// Per-row quick-glance trigger for the parts list (Task 8). A small client
// island that owns the open/close state for one part's PartGlanceModal so the
// parts-list page can stay a server component — it renders one of these per row
// alongside the existing MPN → detail link (which is untouched).
//
// The glance IconButton matches the bench icon affordance used across the app
// (ghost glyph + Radix tooltip). The modal mounts only while open so the
// `glancePart` fetch fires on demand, not for every listed row.

import { useState } from "react";

import { IconButton } from "@/components/IconButton";
import { EyeIcon } from "@/components/icons";
import { PartGlanceModal } from "@/components/parts/PartGlanceModal";

export function PartGlanceTrigger({
  partId,
  mpn,
}: {
  partId: string;
  mpn: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        type="button"
        hint="Quick glance"
        ariaLabel={`Quick glance: ${mpn}`}
        onClick={() => setOpen(true)}
      >
        <EyeIcon className="h-5 w-5" />
      </IconButton>
      {open ? (
        <PartGlanceModal
          partId={partId}
          mpn={mpn}
          open={open}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
