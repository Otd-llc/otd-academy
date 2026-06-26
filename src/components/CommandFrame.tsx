// CommandFrame — the "official document" backdrop shared by the credential and
// dossier surfaces (verify, briefs, license). A faint gold honeycomb field plus
// four corner registration brackets, matching the printed capability briefs and
// the certificate itself. Drop it as the first child of a `relative isolate`
// container; it paints behind the content (`-z-10`) and is purely decorative
// (aria-hidden, pointer-events-none).
//
// The honeycomb is an inline SVG data-URI (no network, no extra asset) tinted to
// command-gold at 4% — present enough to read as the OTD hex motif, faint enough
// to never fight body text.

const HONEYCOMB =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8963e' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

export function CommandFrame({
  honeycomb = true,
  brackets = true,
}: {
  /** Paint the faint hex field. */
  honeycomb?: boolean;
  /** Paint the four corner registration brackets. */
  brackets?: boolean;
}) {
  return (
    <>
      {honeycomb ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ backgroundImage: HONEYCOMB, backgroundSize: "104px auto" }}
        />
      ) : null}
      {brackets ? (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t border-command-gold/40"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r border-t border-command-gold/40"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b border-l border-command-gold/40"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b border-r border-command-gold/40"
          />
        </>
      ) : null}
    </>
  );
}
