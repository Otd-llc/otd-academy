/** Short "x ago" label. Pure; `now` is injected so it's deterministic in tests. */
export function relativeAge(from: Date, now: Date): string {
  const secs = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
