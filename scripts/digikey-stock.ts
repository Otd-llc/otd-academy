// Live DigiKey stock/price/lifecycle screen for a list of MPNs (board sourcing).
// Reuses the project's own DigiKey client (src/lib/digikey.ts); needs
// DIGIKEY_CLIENT_ID/SECRET in .env.local. Run in PowerShell:
//   pnpm exec tsx scripts/digikey-stock.ts MPN1 MPN2 ...
// Prints one row per MPN: matched · stock · unit price · lifecycle · DK part no.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

async function main() {
  const mpns = process.argv.slice(2);
  if (mpns.length === 0) {
    console.error("usage: tsx scripts/digikey-stock.ts MPN1 MPN2 ...");
    process.exit(1);
  }
  const { makeDigikeyClient, digikeyConfigured } = await import("@/lib/digikey");
  if (!digikeyConfigured()) throw new Error("DigiKey not configured (.env.local DIGIKEY_CLIENT_ID/SECRET)");
  const dk = await makeDigikeyClient();

  console.log("MPN".padEnd(28), "match".padEnd(6), "stock".padEnd(10), "price".padEnd(9), "lifecycle".padEnd(14), "DKpart");
  for (const mpn of mpns) {
    try {
      const s = await dk.searchByMpn(mpn);
      const price = s.unitPriceCents == null ? "—" : `$${(s.unitPriceCents / 100).toFixed(3)}`;
      console.log(
        mpn.padEnd(28),
        String(s.matched).padEnd(6),
        String(s.stockQty ?? "—").padEnd(10),
        price.padEnd(9),
        String(s.lifecycle ?? "—").padEnd(14),
        s.partNumber ?? "—",
      );
    } catch (e) {
      console.log(mpn.padEnd(28), "ERR".padEnd(6), String((e as Error).message).slice(0, 60));
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
