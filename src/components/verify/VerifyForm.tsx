"use client";

// Certificate-code entry for /verify. Codes are always OTD-XXXX-XXXX (8 hex
// chars), so the "OTD-" and the dash are fixed scaffolding the visitor should
// never have to type: they enter the 8 characters and we format as they go.
// Pasting a full code (OTD-A1B2-C3D4), the bare 8 chars, or even a whole
// /verify?code=... link all normalize to the same thing. Submitting navigates to
// ?code=..., which the server page verifies.
import { useRouter } from "next/navigation";
import { useState } from "react";

// Pull the 8 significant characters out of whatever was typed or pasted.
function extractChars(input: string): string {
  let s = input ?? "";
  const m = s.match(/code=([^&\s]+)/i); // a pasted URL or "?code=..."
  if (m) s = decodeURIComponent(m[1]);
  s = s.toUpperCase().replace(/[^0-9A-Z]/g, ""); // drop dashes, spaces, etc.
  if (s.startsWith("OTD")) s = s.slice(3); // drop the fixed prefix if pasted
  return s.slice(0, 8);
}

// "A1B2C3D4" -> "A1B2-C3D4" (partial as you type).
function dashed(chars: string): string {
  const a = chars.slice(0, 4);
  const b = chars.slice(4, 8);
  return b ? `${a}-${b}` : a;
}

export function VerifyForm({ initialCode }: { initialCode?: string }) {
  const router = useRouter();
  const [chars, setChars] = useState(() => extractChars(initialCode ?? ""));
  const ready = chars.length === 8;
  const fullCode = `OTD-${dashed(chars)}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ready) router.push(`/verify?code=${fullCode}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 flex w-full max-w-md flex-wrap items-center justify-center gap-3"
    >
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded border border-panel-border bg-navy-dark/80 focus-within:border-command-gold">
        <span className="flex select-none items-center pl-4 pr-0.5 font-mono text-sm tracking-[0.22em] text-muted">
          OTD-
        </span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Certificate code (8 characters)"
          value={dashed(chars)}
          onChange={(e) => setChars(extractChars(e.target.value))}
          placeholder="XXXX-XXXX"
          className="w-full min-w-0 flex-1 bg-transparent py-3 pr-4 font-mono text-sm uppercase tracking-[0.22em] text-gray-1 outline-none placeholder:text-muted"
        />
      </div>
      <button
        type="submit"
        disabled={!ready}
        className="glass-button glass-button-cta px-7 py-3 font-mono text-xs uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Verify
      </button>
    </form>
  );
}
