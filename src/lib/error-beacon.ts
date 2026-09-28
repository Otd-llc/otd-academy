// Browser half of the client error beacon: the error boundaries call this once
// per fault. Sends ONLY the boundary, the pathname, the error name and Next's
// digest (never the message or the query) to POST /api/beacon/error, which
// captures server-side. Fire-and-forget: it never throws and never blocks the
// fallback UI.
import type { Boundary } from "@/lib/error-telemetry";

export const ERROR_BEACON_PATH = "/api/beacon/error";

export function reportClientError(
  error: (Error & { digest?: string }) | undefined,
  boundary: Boundary,
): void {
  try {
    const body = JSON.stringify({
      boundary,
      path: window.location.pathname,
      name: error?.name,
      digest: error?.digest,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ERROR_BEACON_PATH, blob)) return;
    void fetch(ERROR_BEACON_PATH, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    // Reporting a fault must never cause one.
  }
}
