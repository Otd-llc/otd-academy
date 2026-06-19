export type AvailabilityStatus =
  | "OK"
  | "OUT_OF_STOCK"
  | "EOL"
  | "OBSOLETE"
  | "NRND"
  | "STALE"
  | "UNKNOWN";

export interface AvailabilityInput {
  dkInStock: boolean | null;
  dkLifecycle: string | null;
  dkCheckedAt: Date | null;
  // unused after V3 dropped DIVERGENT; kept optional for a future non-blocking
  // "divergence" note (curated lifecycle vs DigiKey observed).
  curatedLifecycle?: string;
}

const STALE_DAYS = 7;

// V2: "can't buy it" = genuinely unbuildable. NRND / "not recommended for new
// designs" is still IN STOCK + buyable, so it is NOTED but NOT unbuildable.
function isUnbuyable(dk: string): boolean {
  return (
    dk.includes("obsolete") ||
    dk.includes("discontinued") ||
    dk.includes("end of life") ||
    dk.includes("last time buy")
  );
}

function isNrnd(dk: string): boolean {
  return dk.includes("not recommended") || dk === "nrnd";
}

export function assessPartAvailability(
  i: AvailabilityInput,
  now: Date,
): { status: AvailabilityStatus; buildable: boolean } {
  if (i.dkCheckedAt == null) return { status: "UNKNOWN", buildable: true }; // not yet checked → don't block
  if ((now.getTime() - i.dkCheckedAt.getTime()) / 86_400_000 > STALE_DAYS) {
    return { status: "STALE", buildable: true };
  }
  const dk = (i.dkLifecycle ?? "").toLowerCase();
  if (dk.includes("obsolete")) return { status: "OBSOLETE", buildable: false };
  if (isUnbuyable(dk)) return { status: "EOL", buildable: false };
  if (i.dkInStock === false) return { status: "OUT_OF_STOCK", buildable: false };
  if (isNrnd(dk)) return { status: "NRND", buildable: true }; // V2: buyable, just discouraged → noted, not blocking
  return { status: "OK", buildable: true };
}

export function countUnbuildable(lines: AvailabilityInput[], now: Date): number {
  return lines.filter((l) => !assessPartAvailability(l, now).buildable).length;
}
