"use client";

// Certificate-code entry for /verify, styled as the registry query terminal.
// Codes are always OTD-XXXX-XXXX (8 hex chars), so the "OTD-" and the dash are
// fixed scaffolding the visitor never types: they enter the 8 characters and we
// format as they go. Pasting a full code (OTD-A1B2-C3D4), the bare 8 chars, or a
// whole /verify?code=... link all normalize to the same thing. Submitting
// navigates to ?code=..., which the server page verifies.
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
    <form onSubmit={submit} className="mt-10">
      <div className="flex items-stretch overflow-hidden rounded-md border border-command-gold/30 bg-deep-space/70 transition-colors focus-within:border-command-gold/70">
        <span
          aria-hidden="true"
          className="flex select-none items-center pl-4 pr-1 font-mono text-base tracking-[0.18em] text-command-gold sm:pl-5"
        >
          OTD-
        </span>
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Certificate code, the 8 characters after OTD-"
          value={dashed(chars)}
          onChange={(e) => setChars(extractChars(e.target.value))}
          placeholder="XXXX-XXXX"
          className="min-w-0 flex-1 bg-transparent py-4 pl-1 pr-2 font-mono text-base uppercase tracking-[0.3em] text-title outline-none placeholder:text-muted sm:text-lg"
        />
        <button
          type="submit"
          disabled={!ready}
          className="glass-button glass-button-cta m-1.5 shrink-0 px-5 font-mono text-xs uppercase tracking-[0.18em] sm:px-7"
        >
          Verify
        </button>
      </div>
      <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        8 characters · dashes added for you
      </p>
    </form>
  );
}
