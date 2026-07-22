"use client";

// Root error boundary (audit Phase 6). Before this existed, ANY uncaught throw
// on a learner page — a Neon timeout, a serialization conflict outliving its
// retries — rendered Next's default unstyled "Application error" with no way
// back. global-error replaces the ROOT layout when even the layout throws, so
// it must render its own <html>/<body>, read no session/DB, and carry its own
// inline styles (globals.css may not have loaded). Dark-first with a light
// fallback via prefers-color-scheme, token values inlined.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#08090d",
          color: "#e8e8e8",
          fontFamily: "'Space Mono', ui-monospace, monospace",
        }}
      >
        <main style={{ maxWidth: 420, padding: "0 24px", textAlign: "center" }}>
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "#c8963e",
            }}
          >
            ▸ Fault
          </p>
          <h1
            style={{
              marginTop: 12,
              fontSize: 28,
              letterSpacing: "0.04em",
              fontWeight: 700,
            }}
          >
            Something failed on our side
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#aaaaaa" }}>
            Your progress is saved on the server. Try again; if this keeps
            happening, come back in a few minutes.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "12px 30px",
              border: "1px solid #c8963e",
              borderRadius: 4,
              background: "transparent",
              color: "#c8963e",
              fontFamily: "inherit",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
