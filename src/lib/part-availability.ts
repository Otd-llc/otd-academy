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

export type AvailabilityTone = "green" | "amber" | "red" | "grey";

// Presentation mapping shared by every surface (guide BOM chip, admin BOM
// editor, parts catalog) so the watchdog reads consistently. Pure: status → UI.
export function availabilityBadge(
  status: AvailabilityStatus,
): { label: string; tone: AvailabilityTone; title: string } {
  switch (status) {
    case "OK":
      return { label: "in stock", tone: "green", title: "In stock at DigiKey" };
    case "NRND":
      return {
        label: "NRND",
        tone: "amber",
        title: "In stock but not recommended for new designs",
      };
    case "OUT_OF_STOCK":
      return { label: "out of stock", tone: "red", title: "Out of stock at DigiKey" };
    case "EOL":
      return { label: "EOL", tone: "red", title: "End-of-life / discontinued at DigiKey" };
    case "OBSOLETE":
      return { label: "obsolete", tone: "red", title: "Obsolete at DigiKey" };
    case "STALE":
      return { label: "stale", tone: "grey", title: "DigiKey check is out of date" };
    case "UNKNOWN":
    default:
      return { label: "unchecked", tone: "grey", title: "Not yet checked at DigiKey" };
  }
}
