// Retry helper for Serializable transactions.
//
// Per design §5.3, the action layer retries on SSI serialization failures.
// Postgres emits SQLSTATE 40001 for serialization_failure and 40P01 for
// deadlock_detected; Prisma surfaces both with the same family of
// "Transaction failed due to a write conflict or a deadlock" message,
// usually under `PrismaClientKnownRequestError` (varying codes across
// versions) or `PrismaClientUnknownRequestError`. We match on the message
// text since Prisma's code mapping for the underlying SQLSTATE has shifted
// across versions and isn't load-bearing for retry semantics.
//
// Backoff is intentionally short: SSI conflicts in this app's working set
// are rare enough that a few attempts at single-digit-ms jitter dominate.
const DEFAULTS = {
  maxAttempts: 5,
  baseDelayMs: 5,
};

function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes("write conflict") ||
    msg.includes("deadlock") ||
    msg.includes("could not serialize")
  );
}

export async function withTxRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULTS.baseDelayMs;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      const jitter = Math.random() * baseDelayMs;
      const delay = baseDelayMs * attempt + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Unreachable — the loop either returns or throws.
  throw lastErr;
}
