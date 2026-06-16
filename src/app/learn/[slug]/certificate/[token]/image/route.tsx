// PNG render of the certificate (landscape A4 ratio) — the on-page <img> display
// AND the og:image. Mirrors the @react-pdf PDF exactly: bundled Garamond (serif) +
// Great Vibes (script) fonts, ONE emblem (the OTD bee, only as the seal), a gold
// frame with corner ornaments, a faint bee watermark, and the Date · Seal ·
// Signature footer. Bad token → branded fallback, never a 500.
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { verifyCardToken, type CardClaims } from "@/lib/certificate-token";
import { certificateId } from "@/lib/certificate-id";
import { certFontData } from "@/lib/pdf/cert-font-files";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX, CERT_SKILLS } from "@/lib/pdf/certificate-content";

export const runtime = "nodejs";
export const size = { width: 1200, height: 848 };
export const contentType = "image/png";

const IVORY = "#faf7f0";
const PAPER_2 = "#f3eee3";
const INK = "#14181f";
const GOLD = "#b5882e";
const HAIRLINE = "#d8cfbe";
const MUTED = "#6b7280";
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

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

function Seal() {
  const ticks = Array.from({ length: 24 });
  return (
    <div style={{ position: "relative", width: 130, height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {ticks.map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: i % 2 === 0 ? 2.5 : 1.5,
            height: i % 2 === 0 ? 9 : 5,
            backgroundColor: i % 2 === 0 ? GOLD : HAIRLINE,
            transform: `rotate(${i * 15}deg) translateY(-60px)`,
            transformOrigin: "center",
          }}
        />
      ))}
      <div style={{ position: "absolute", width: 104, height: 104, borderRadius: 104, border: `2px solid ${GOLD}` }} />
      <div style={{ position: "absolute", width: 84, height: 84, borderRadius: 84, border: `1px solid ${HAIRLINE}` }} />
      <svg width="46" height="44" viewBox={BRANDMARK_VIEWBOX} fill={GOLD}>
        <path d={BRANDMARK_PATH} />
      </svg>
    </div>
  );
}

function cornerStyle(pos: "tl" | "tr" | "bl" | "br") {
  const b = `1.2px solid ${GOLD}`;
  const base: Record<string, string | number> = { position: "absolute", width: 28, height: 28 };
  if (pos === "tl") return { ...base, top: 34, left: 34, borderTop: b, borderLeft: b };
  if (pos === "tr") return { ...base, top: 34, right: 34, borderTop: b, borderRight: b };
  if (pos === "bl") return { ...base, bottom: 34, left: 34, borderBottom: b, borderLeft: b };
  return { ...base, bottom: 34, right: 34, borderBottom: b, borderRight: b };
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
        backgroundImage: `radial-gradient(1100px 760px at 50% 40%, ${IVORY} 30%, ${PAPER_2} 100%)`,
        padding: "60px 90px",
        fontFamily: SANS,
        color: INK,
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* faint bee watermark */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="320" height="306" viewBox={BRANDMARK_VIEWBOX} fill={GOLD} style={{ opacity: 0.05 }}>
          <path d={BRANDMARK_PATH} />
        </svg>
      </div>
      {/* frame + corners */}
      <div style={{ position: "absolute", top: 22, left: 22, right: 22, bottom: 22, border: `2px solid ${GOLD}` }} />
      <div style={{ position: "absolute", top: 29, left: 29, right: 29, bottom: 29, border: `1px solid ${MUTED}` }} />
      <div style={cornerStyle("tl")} />
      <div style={cornerStyle("tr")} />
      <div style={cornerStyle("bl")} />
      <div style={cornerStyle("br")} />

      {/* header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 16, letterSpacing: 6, color: MUTED, textTransform: "uppercase" }}>
          One Thousand Drones Academy
        </div>
        <div style={{ display: "flex", marginTop: 16, fontFamily: "Serif", fontSize: 64, letterSpacing: 8, color: INK, textTransform: "uppercase" }}>
          Certificate
        </div>
        <div style={{ display: "flex", marginTop: 2, fontFamily: "Serif", fontSize: 24, letterSpacing: 12, color: GOLD, textTransform: "uppercase" }}>
          of {isCert ? "Achievement" : "Completion"}
        </div>
      </div>

      {/* middle */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 13, letterSpacing: 3, color: MUTED, textTransform: "uppercase" }}>
          This certifies that
        </div>
        <div style={{ display: "flex", fontFamily: "Script", fontSize: 92, color: INK, marginTop: 2 }}>
          {claims.name}
        </div>
        <div style={{ display: "flex", width: 340, height: 1.5, backgroundColor: GOLD, marginTop: 6, marginBottom: 14 }} />
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: 19, fontStyle: "italic", color: MUTED }}>
          {isCert ? "earned this certificate for designing and building" : "designed and built a real board:"}
        </div>
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: 34, color: GOLD, marginTop: 4 }}>{board}</div>
        {hasScore ? (
          <div style={{ display: "flex", marginTop: 8, fontSize: 12, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
            Final exam · {claims.score}/{claims.total} · Passed
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: 16, fontSize: 10, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
          — covered in this build —
        </div>
        <div style={{ display: "flex", marginTop: 5, fontFamily: "Serif", fontSize: 14, color: INK }}>
          {CERT_SKILLS.join("   ·   ")}
        </div>
      </div>

      {/* footer: date · seal · signature */}
      <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
          <div style={{ display: "flex", fontFamily: "Script", fontSize: 30, color: INK }}>{formatDate(claims.date)}</div>
          <div style={{ display: "flex", width: 180, height: 1, backgroundColor: INK, marginTop: 4, marginBottom: 5 }} />
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>Date</div>
        </div>
        <Seal />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
          <div style={{ display: "flex", fontFamily: "Script", fontSize: 30, color: INK }}>Joshua Tollette</div>
          <div style={{ display: "flex", width: 180, height: 1, backgroundColor: INK, marginTop: 4, marginBottom: 5 }} />
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>Founder · One Thousand Drones</div>
        </div>
      </div>

      {/* provenance */}
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", justifyContent: "center", fontSize: 10, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase" }}>
        ID {certId} · Verify at academy.onethousanddrones.com/verify
      </div>
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
    fonts: certFontData(),
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
