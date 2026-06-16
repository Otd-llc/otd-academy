// PNG render of the certificate (landscape A4 ratio) — the on-page <img> display
// AND the og:image. Mirrors the @react-pdf PDF exactly: bundled Crimson Text
// (serif) + Great Vibes (script); ONE emblem (the OTD bee, only as the seal); gold
// rationed (frame · subtitle · rule · seal), board in ink; ornate double-bracket
// corners with a struck diamond; a large faint bee watermark; Date · Seal ·
// Signature footer. Bad token → branded fallback, never a 500.
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { verifyCardToken, type CardClaims } from "@/lib/certificate-token";
import { certificateId } from "@/lib/certificate-id";
import { certFontData } from "@/lib/pdf/cert-font-files";
import { publicTitle } from "@/lib/public-titles";
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
const FAINT = "#9aa0ad";
const SANS = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

async function resolveBoard(slug: string): Promise<string> {
  try {
    const p = await db.project.findUnique({ where: { slug }, select: { name: true } });
    return publicTitle(slug, p?.name ?? "a real board");
  } catch {
    return publicTitle(slug, "a real board");
  }
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

// A struck medallion: a clean gold rim with a beaded bezel, the OTD bee large and
// integrated as the device. Beads are positioned with the transform trick (satori
// mis-places top/left absolute children, but rotate+translate works).
function Seal() {
  const beads = Array.from({ length: 32 });
  return (
    <div style={{ position: "relative", width: 168, height: 168, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {beads.map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 3,
            height: 3,
            borderRadius: 3,
            backgroundColor: GOLD,
            transform: `rotate(${(i * 360) / 32}deg) translateY(-68px)`,
            transformOrigin: "center",
          }}
        />
      ))}
      <div style={{ position: "absolute", width: 158, height: 158, borderRadius: 158, border: `2px solid ${GOLD}` }} />
      <div style={{ position: "absolute", width: 124, height: 124, borderRadius: 124, border: `1px solid ${HAIRLINE}` }} />
      <svg width="118" height="113" viewBox={BRANDMARK_VIEWBOX} fill={GOLD}>
        <path d={BRANDMARK_PATH} />
      </svg>
    </div>
  );
}

// Ornate corners drawn as ONE full-size SVG (satori mis-places absolutely-
// positioned div ornaments — but renders SVG paths at exact coordinates
// reliably). Each corner: an outer + inner L-bracket and a struck diamond.
function CornerOrnaments({ w, h }: { w: number; h: number }) {
  const m = 34; // margin from the page edge to the vertex
  const arm = 36;
  const off = 8;
  const armIn = 20;
  const dr = 6; // diamond radius
  const corners = [
    { x: m, y: m, sx: 1, sy: 1 },
    { x: w - m, y: m, sx: -1, sy: 1 },
    { x: m, y: h - m, sx: 1, sy: -1 },
    { x: w - m, y: h - m, sx: -1, sy: -1 },
  ];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", top: 0, left: 0 }}>
      {/* fine beaded inner line, echoing the seal's bezel */}
      <rect x={40} y={40} width={w - 80} height={h - 80} stroke={GOLD} strokeWidth={1} strokeDasharray="1.5 5" fill="none" />
      {corners.map((c, i) => (
        <g key={i}>
          <path d={`M ${c.x} ${c.y + c.sy * arm} L ${c.x} ${c.y} L ${c.x + c.sx * arm} ${c.y}`} stroke={GOLD} strokeWidth={1.6} fill="none" />
          <path d={`M ${c.x + c.sx * off} ${c.y + c.sy * (off + armIn)} L ${c.x + c.sx * off} ${c.y + c.sy * off} L ${c.x + c.sx * (off + armIn)} ${c.y + c.sy * off}`} stroke={GOLD} strokeWidth={1} fill="none" />
          <path d={`M ${c.x} ${c.y - dr} L ${c.x + dr} ${c.y} L ${c.x} ${c.y + dr} L ${c.x - dr} ${c.y} Z`} fill={GOLD} />
        </g>
      ))}
    </svg>
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
        backgroundImage: `radial-gradient(1100px 760px at 50% 40%, ${IVORY} 30%, ${PAPER_2} 100%)`,
        padding: "66px 96px",
        fontFamily: SANS,
        color: INK,
        textAlign: "center",
        position: "relative",
      }}
    >
      {/* large faint bee watermark */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="560" height="536" viewBox={BRANDMARK_VIEWBOX} fill={GOLD} style={{ opacity: 0.035 }}>
          <path d={BRANDMARK_PATH} />
        </svg>
      </div>
      {/* frame + ornate corners */}
      <div style={{ position: "absolute", top: 22, left: 22, right: 22, bottom: 22, border: `2px solid ${GOLD}` }} />
      <div style={{ position: "absolute", top: 29, left: 29, right: 29, bottom: 29, border: `1px solid ${MUTED}` }} />
      <CornerOrnaments w={size.width} h={size.height} />

      {/* header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 16, letterSpacing: 6, color: MUTED, textTransform: "uppercase" }}>
          One Thousand Drones Academy
        </div>
        <div style={{ display: "flex", marginTop: 14, fontFamily: "Serif", fontSize: 60, letterSpacing: 5, color: INK, textTransform: "uppercase" }}>
          Certificate
        </div>
        <div style={{ display: "flex", marginTop: 3, fontFamily: "Serif", fontSize: 23, letterSpacing: 9, color: GOLD, textTransform: "uppercase" }}>
          of {isCert ? "Achievement" : "Completion"}
        </div>
      </div>

      {/* middle */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 13, letterSpacing: 3, color: FAINT, textTransform: "uppercase" }}>
          This certifies that
        </div>
        <div style={{ display: "flex", fontFamily: "Script", fontSize: 92, color: INK, marginTop: 4 }}>
          {claims.name}
        </div>
        <div style={{ display: "flex", width: 360, height: 1.5, backgroundColor: GOLD, marginTop: 10, marginBottom: 20 }} />
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: 19, fontStyle: "italic", color: MUTED }}>
          {isCert ? "earned this certificate for designing and building" : "designed and built a real board:"}
        </div>
        <div style={{ display: "flex", fontFamily: "Serif", fontSize: 35, color: INK, marginTop: 5 }}>{board}</div>
        {hasScore ? (
          <div style={{ display: "flex", marginTop: 12, fontSize: 11, letterSpacing: 2, color: FAINT, textTransform: "uppercase" }}>
            Final exam · {claims.score}/{claims.total} · Passed
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: 22, fontSize: 9, letterSpacing: 2, color: FAINT, textTransform: "uppercase" }}>
          — covered in this build —
        </div>
        <div style={{ display: "flex", marginTop: 6, fontFamily: "Serif", fontSize: 13, color: MUTED }}>
          {CERT_SKILLS.join("   ·   ")}
        </div>
      </div>

      {/* footer: date · seal · signature */}
      <div style={{ width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: 24, color: INK }}>{formatDate(claims.date)}</div>
          <div style={{ display: "flex", width: 190, height: 1, backgroundColor: INK, marginTop: 4, marginBottom: 5 }} />
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>Date</div>
        </div>
        <Seal />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
          <div style={{ display: "flex", fontFamily: "Script", fontSize: 34, color: INK }}>Joshua Tollette</div>
          <div style={{ display: "flex", width: 190, height: 1, backgroundColor: INK, marginTop: 4, marginBottom: 5 }} />
          <div style={{ display: "flex", fontSize: 11, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>Founder · One Thousand Drones</div>
        </div>
      </div>

      {/* provenance */}
      <div style={{ position: "absolute", bottom: 44, left: 0, right: 0, display: "flex", justifyContent: "center", fontSize: 10, letterSpacing: 1.5, color: FAINT, textTransform: "uppercase" }}>
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
