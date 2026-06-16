// Deterministic, human-readable certificate id derived from the signed token, so
// the same certificate always shows the same ID (printed on the PDF, doubles as a
// lightweight verification reference alongside the share URL).
import { createHash } from "node:crypto";

export function certificateId(token: string): string {
  const h = createHash("sha256").update(token).digest("hex").toUpperCase();
  return `OTD-${h.slice(0, 4)}-${h.slice(4, 8)}`;
}
