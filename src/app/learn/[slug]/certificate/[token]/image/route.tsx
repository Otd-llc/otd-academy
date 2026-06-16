// PNG render of the certificate (landscape A4 ratio) — used BOTH as the on-page
// display (an <img>, which renders reliably everywhere, unlike an embedded PDF)
// and as the og:image for link previews. Mirrors the @react-pdf PDF: light ivory,
// brand logo + wordmark, serif-less but disciplined type, the wax-seal × PCB
// instrument-dial seal, signature, skills, date, cert ID, and the /verify line.
// Signed token (verified here) carries name + variant; bad token → branded
// fallback, never a 500.
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { verifyCardToken, type CardClaims } from "@/lib/certificate-token";
import { certificateId } from "@/lib/certificate-id";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX, CERT_SKILLS } from "@/lib/pdf/certificate-content";

export const runtime = "nodejs";
export const size = { width: 1200, height: 848 };
export const contentType = "image/png";

const IVORY = "#faf7f0";
const PAPER_2 = "#f1ece1";
const INK = "#0d1117";
const GOLD = "#b5882e";
const HAIRLINE = "#d8cfbe";
const MUTED = "#6b7280";
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

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

function formatDate(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function Seal({ isCert }: { isCert: boolean }) {
  const ticks = Array.from({ length: 24 });
  return (
    <div style={{ position: "relative", width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ticks.map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: i % 2 === 0 ? 2.5 : 1.5,
            height: i % 2 === 0 ? 9 : 5,
            backgroundColor: i % 2 === 0 ? GOLD : HAIRLINE,
            transform: `rotate(${i * 15}deg) translateY(-61px)`,
            transformOrigin: "center",
          }}
        />
      ))}
      <div style={{ position: "absolute", width: 104, height: 104, borderRadius: 104, border: `2px solid ${GOLD}` }} />
      <div style={{ position: "absolute", width: 82, height: 82, borderRadius: 82, border: `1px solid ${HAIRLINE}` }} />
      <svg width="46" height="46" viewBox="0 0 100 100" fill={GOLD}>
        <path d={isCert ? STAR : CHECK} />
      </svg>
    </div>
  );
}

function Card({ claims, board, certId }: { claims: CardClaims; board: string; certId: string }) {
  const isCert = claims.variant === "cert";
  const hasScore = isCert && typeof claims.score === "number" && typeof claims.total === "number";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: IVORY,
        backgroundImage: `radial-gradient(1100px 700px at 50% -10%, ${PAPER_2} 0%, ${IVORY} 62%)`,
        padding: "52px 70px",
        fontFamily: SANS,
        color: INK,
        textAlign: "center",
      }}
    >
      {/* logo + wordmark */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg width="52" height="50" viewBox={BRANDMARK_VIEWBOX} fill={GOLD}>
          <path d={BRANDMARK_PATH} />
        </svg>
        <div style={{ display: "flex", marginTop: 8, fontSize: 18, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>
          <span style={{ color: INK }}>One Thousand Drones&nbsp;</span>
          <span style={{ color: GOLD }}>Academy</span>
        </div>
      </div>

      {/* body */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 2, textTransform: "uppercase", color: GOLD }}>
          Certificate of {isCert ? "Achievement" : "Completion"}
        </div>
        <div style={{ display: "flex", marginTop: 14, fontSize: 18, fontStyle: "italic", color: MUTED }}>
          This certifies that
        </div>
        <div style={{ display: "flex", marginTop: 6, fontSize: 64, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1, color: INK }}>
          {claims.name}
        </div>
        <div style={{ display: "flex", width: 300, height: 1.5, backgroundColor: GOLD, marginTop: 14, marginBottom: 14 }} />
        <div style={{ display: "flex", fontSize: 18, fontStyle: "italic", color: MUTED }}>
          {isCert ? "earned this certificate for designing and building" : "designed and built a real board:"}
        </div>
        <div style={{ display: "flex", marginTop: 6, fontSize: 32, fontWeight: 700, color: GOLD }}>{board}</div>
        {hasScore ? (
          <div style={{ display: "flex", marginTop: 8, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
            Final exam · {claims.score}/{claims.total} · Passed
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: 16, fontSize: 11, letterSpacing: 1, color: INK }}>
          {CERT_SKILLS.join("   ·   ")}
        </div>
      </div>

      {/* footer: signature · seal · meta */}
      <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: 320 }}>
          <div style={{ display: "flex", fontSize: 24, fontStyle: "italic", color: INK }}>Joshua Tollette</div>
          <div style={{ display: "flex", width: 200, height: 1, backgroundColor: INK, marginTop: 4, marginBottom: 5 }} />
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: MUTED }}>Founder · One Thousand Drones</div>
        </div>
        <Seal isCert={isCert} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: 320 }}>
          <div style={{ display: "flex", fontSize: 12, fontWeight: 700, letterSpacing: 1, color: INK }}>{formatDate(claims.date)}</div>
          <div style={{ display: "flex", marginTop: 4, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: INK }}>ID {certId}</div>
          <div style={{ display: "flex", marginTop: 4, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: MUTED }}>verify · academy.onethousanddrones.com/verify</div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 18, left: 18, right: 18, bottom: 18, border: `1.5px solid ${GOLD}` }} />
      <div style={{ position: "absolute", top: 25, left: 25, right: 25, bottom: 25, border: `1px solid ${HAIRLINE}` }} />
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
  return new ImageResponse(<Card claims={claims} board={board} certId={certificateId(token)} />, {
    ...size,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
