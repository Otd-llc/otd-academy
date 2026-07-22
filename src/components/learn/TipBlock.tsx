"use client";

// One-time "Support the Academy" tip block on the Lesson Complete screen.
// Presets ($3/$5/$10) + a custom amount; on submit it creates a Stripe Checkout
// session (guest-capable) and redirects. A tip grants nothing — it's support, not
// a purchase. Framed as a tip, never a "donation" (OTD is not a 501(c)(3)).
import { useState, useTransition } from "react";
import { createTipCheckout } from "@/lib/actions/tips";
import { TIP_PRESETS_CENTS, TIP_MIN_CENTS, TIP_MAX_CENTS } from "@/lib/tips";

const presetLabel = (cents: number) => `$${cents / 100}`;

export function TipBlock({ slug }: { slug: string }) {
  const [preset, setPreset] = useState<number | "custom">(TIP_PRESETS_CENTS[1]);
  const [customDollars, setCustomDollars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function resolveCents(): number | null {
    if (preset !== "custom") return preset;
    const dollars = Number(customDollars);
    if (!Number.isFinite(dollars)) return null;
    return Math.round(dollars * 100);
  }

  function checkout() {
    const cents = resolveCents();
    if (cents === null || cents < TIP_MIN_CENTS || cents > TIP_MAX_CENTS) {
      setError(`Enter an amount between $1 and $500.`);
      return;
    }
    start(async () => {
      setError(null);
      try {
        const { url } = await createTipCheckout({ amountCents: cents, slug });
        window.location.href = url;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start checkout.");
      }
    });
  }

  return (
    <section className="w-full max-w-2xl border-t border-panel-border/60 pt-6 text-left">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ Support the Academy
      </span>
      <h2 className="title-section mt-2">
        Support the <span className="text-command-gold">Academy</span>
      </h2>
      <p className="mt-2 font-serif text-sm italic text-muted">
        If this build helped, a one-time tip keeps the next board coming. A tip
        buys nothing and unlocks nothing; it just helps.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {TIP_PRESETS_CENTS.map((cents) => (
          <button
            key={cents}
            type="button"
            onClick={() => setPreset(cents)}
            aria-pressed={preset === cents}
            className={`rounded border px-4 py-2 font-numeral text-sm tabular-nums uppercase tracking-[0.14em] transition-colors focus-visible:border-command-gold focus-visible:outline-none ${
              preset === cents
                ? "border-command-gold bg-command-gold text-deep-space"
                : "border-panel-border bg-transparent text-command-gold hover:border-command-gold"
            }`}
          >
            {presetLabel(cents)}
          </button>
        ))}
        <div
          className={`flex items-center gap-1 rounded border px-3 py-2 ${
            preset === "custom" ? "border-command-gold" : "border-panel-border"
          }`}
        >
          <span className="font-numeral text-sm text-muted">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={500}
            step="1"
            placeholder="other"
            value={customDollars}
            onFocus={() => setPreset("custom")}
            onChange={(e) => {
              setPreset("custom");
              setCustomDollars(e.target.value);
            }}
            className="w-20 bg-transparent font-numeral text-sm tabular-nums text-text outline-none focus-visible:outline-none placeholder:font-mono placeholder:text-muted"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={checkout}
        disabled={pending}
        className="glass-button glass-button-cta mt-5 inline-block px-6 py-3 font-mono text-sm uppercase tracking-[0.16em] disabled:opacity-50"
      >
        {pending ? "Starting…" : "Continue to checkout →"}
      </button>
      {error && (
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-alert-red">
          {error}
        </p>
      )}
    </section>
  );
}
