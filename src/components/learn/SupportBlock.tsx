import { affiliateLink, type AffiliateVendor } from "@/lib/affiliates";

// Affiliate split (design §7): boards → PCBWay/JLCPCB, parts → DigiKey, bench → Amazon.
const ITEMS: { vendor: AffiliateVendor; label: string; sub: string }[] = [
  { vendor: "pcbway-order", label: "Order the board", sub: "PCBWay" },
  { vendor: "jlcpcb", label: "Order the board", sub: "JLCPCB" },
  { vendor: "digikey-bom", label: "Order the parts", sub: "DigiKey" },
  { vendor: "amazon-bench", label: "Bench gear", sub: "Amazon" },
];

export function SupportBlock() {
  return (
    <section className="glass-card w-full max-w-2xl p-6 sm:p-7">
      <h2 className="font-display text-xl tracking-wider text-gray-1">
        Build it for <span className="text-command-gold">real</span>
      </h2>
      <p className="mt-2 font-serif text-sm italic text-gray-2">
        Order through our links — same price, and it supports the Academy at no
        extra cost to you.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ITEMS.map((it) => {
          const { href } = affiliateLink(it.vendor);
          return (
            <a
              key={`${it.vendor}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="glass-button flex items-center justify-between gap-3 px-4 py-3 font-mono text-sm uppercase tracking-[0.14em]"
            >
              <span>{it.label}</span>
              <span className="text-[10px] text-gold-dim">{it.sub}</span>
            </a>
          );
        })}
      </div>
      {/* FTC + Amazon disclosures — adjacent to the links, never footer-only. */}
      <p className="mt-4 font-mono text-[10px] leading-relaxed tracking-wide text-muted">
        Affiliate links — buying through them supports the academy at no extra
        cost to you. As an Amazon Associate, the academy earns from qualifying
        purchases.
      </p>
    </section>
  );
}
