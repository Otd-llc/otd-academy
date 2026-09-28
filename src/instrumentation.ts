// Next.js instrumentation hook. `onRequestError` fires for every uncaught server
// error (render, route handler, server action, proxy) and reports it as a
// `server_error` event: path (no query), method, route, error name and digest.
// No bodies, no headers, no messages: see `@/lib/error-telemetry`.
//
// Node runtime only. The analytics client is posthog-node, and the dynamic
// import keeps it out of any edge bundle. `captureNow` is awaited (the
// invocation may be frozen as soon as this returns), bounded to 1.5 s, and never
// throws, so a PostHog outage cannot turn one error into two.
import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const [{ captureNow }, { serverErrorProperties, SERVER_ERROR_EVENT }] =
      await Promise.all([
        import("@/lib/analytics"),
        import("@/lib/error-telemetry"),
      ]);
    await captureNow(
      SERVER_ERROR_EVENT,
      serverErrorProperties(error, request, context),
      "server:error",
    );
  } catch {
    // Reporting an error must never raise another one.
  }
};
