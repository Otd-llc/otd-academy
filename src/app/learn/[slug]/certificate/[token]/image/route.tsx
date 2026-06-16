// Social-thumbnail (og:image) version of the certificate — a light, certificate-
// styled 1200×630 PNG for link previews (crawlers can't render the PDF). The
// downloadable/displayed artifact is the @react-pdf PDF; this just mirrors its
// look (ivory · ink · gold · seal · border) so a shared link previews on-brand.
// Signed token (verified here) carries name + variant; bad token → branded
// fallback, never a 500.
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { verifyCardToken, type CardClaims } from "@/lib/certificate-token";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const IVORY = "#faf7f0";
const PAPER_2 = "#f1ece1";
const INK = "#0d1117";
const GOLD = "#b5882e";
const HAIRLINE = "#d8cfbe";
const MUTED = "#6b7280";
const SANS =
  "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

const STAR =
  "M50 27 L57.3 41.8 L73.6 44.2 L61.8 55.7 L64.6 71.9 L50 64.3 L35.4 71.9 L38.2 55.7 L26.4 44.2 L42.7 41.8 Z";
const CHECK = "M38 51 L46 59 L64 40 L68.5 44.5 L46 68 L33.5 55.5 Z";

async function resolveBoard(slug: string): Promise<string> {
  try {
    const p = await db.project.findUnique({ where: { slug }, select: { name: true } });
    return p?.name ?? "a real board";
  } catch {
    return "a real board";
  }
}

function Seal({ isCert }: { isCert: boolean }) {
  const ticks = Array.from({ length: 24 });
  return (
    <div style={{ position: "relative", width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ticks.map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: i % 2 === 0 ? 3 : 2,
            height: i % 2 === 0 ? 10 : 6,
            backgroundColor: i % 2 === 0 ? GOLD : HAIRLINE,
            transform: `rotate(${i * 15}deg) translateY(-78px)`,
            transformOrigin: "center",
          }}
        />
      ))}
      <div style={{ position: "absolute", width: 134, height: 134, borderRadius: 134, border: `2px solid ${GOLD}` }} />
      <div style={{ position: "absolute", width: 106, height: 106, borderRadius: 106, border: `1px solid ${HAIRLINE}` }} />
      <svg width="58" height="58" viewBox="0 0 100 100" fill={GOLD}>
        <path d={isCert ? STAR : CHECK} />
      </svg>
    </div>
  );
}

function Card({ claims, board }: { claims: CardClaims; board: string }) {
  const isCert = claims.variant === "cert";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: IVORY,
        backgroundImage: `radial-gradient(1200px 700px at 80% -20%, ${PAPER_2} 0%, ${IVORY} 60%)`,
        padding: "56px 72px",
        fontFamily: SANS,
        color: INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>
          <span style={{ color: INK }}>One Thousand Drones&nbsp;</span>
          <span style={{ color: GOLD }}>Academy</span>
        </div>
        <Seal isCert={isCert} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: -20 }}>
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: GOLD }}>
          Certificate of {isCert ? "Achievement" : "Completion"}
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 18, fontStyle: "italic", color: MUTED }}>
          This certifies that
        </div>
        <div style={{ display: "flex", marginTop: 6, fontSize: 76, lineHeight: 1.02, fontWeight: 800, letterSpacing: -1, color: INK }}>
          {claims.name}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 30, fontWeight: 700, color: GOLD }}>{board}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 2, width: 200, backgroundColor: GOLD, marginBottom: 14 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 19, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
          <span>
            {isCert && typeof claims.score === "number" && typeof claims.total === "number"
              ? `Score ${claims.score}/${claims.total} · Passed`
              : "Hands-on hardware"}
          </span>
          <span>academy.onethousanddrones.com</span>
        </div>
      </div>

      <div style={{ position: "absolute", top: 20, left: 20, right: 20, bottom: 20, border: `1.5px solid ${GOLD}` }} />
      <div style={{ position: "absolute", top: 27, left: 27, right: 27, bottom: 27, border: `1px solid ${HAIRLINE}` }} />
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; token: string }> },
) {
  const { token } = await params;
  const claims = verifyCardToken(token);
  if (!claims) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: IVORY, color: GOLD, fontFamily: SANS, fontSize: 40, letterSpacing: 4, textTransform: "uppercase" }}>
          One Thousand Drones Academy
        </div>
      ),
      { ...size },
    );
  }
  const board = await resolveBoard(claims.slug);
  return new ImageResponse(<Card claims={claims} board={board} />, {
    ...size,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
