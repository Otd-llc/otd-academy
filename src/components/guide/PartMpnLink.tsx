"use client";

// A BOM-table part number: a link to the part in the parts library + a
// click-to-open "preview" quick-look popover (manufacturer / description /
// datasheet, and an Open-in-library link). Built on Radix Popover like
// GlossaryTerm — real <button> trigger, focus management + Esc + outside-dismiss
// for free. The parts catalog is public, so the link works for every viewer.

import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { EyeIcon, ExternalLinkIcon } from "@/components/icons";
import { httpUrlOrNull } from "@/lib/safe-url";

export function PartMpnLink({
  partId,
  mpn,
  manufacturer,
  description,
  datasheetUrl,
}: {
  partId: string;
  mpn: string | null;
  manufacturer: string | null;
  description: string | null;
  datasheetUrl: string | null;
}) {
  // No part / no MPN → inert text (graceful, mirrors the table's "·").
  if (!mpn) return <span className="mpn">·</span>;
  const href = `/parts/${partId}`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link
        href={href}
        className="mpn underline decoration-dotted underline-offset-2 transition-colors hover:text-command-gold"
      >
        {mpn}
      </Link>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Preview ${mpn}`}
            className="inline-flex rounded-sm text-gray-3 transition-colors hover:text-command-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-command-gold"
          >
            <EyeIcon className="h-3.5 w-3.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={6}
            collisionPadding={8}
            className="glass-popover z-50 max-w-xs p-3 shadow-xl"
          >
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-command-gold">
              {mpn}
            </p>
            {manufacturer ? (
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-muted">
                {manufacturer}
              </p>
            ) : null}
            {description ? (
              <p className="mt-1.5 font-serif text-sm leading-relaxed text-gray-1">
                {description}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider">
              {httpUrlOrNull(datasheetUrl) ? (
                <a
                  href={httpUrlOrNull(datasheetUrl)!}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 text-signal-blue hover:text-command-gold"
                >
                  Datasheet
                  <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                </a>
              ) : null}
              <Link
                href={href}
                className="font-bold text-command-gold hover:underline"
              >
                Open in library →
              </Link>
            </div>
            <Popover.Arrow className="fill-[rgba(200,150,62,0.35)]" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
