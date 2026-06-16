// Dynamic share/certificate card — the public, shareable 1200×630 PNG of a
// learner's completion. GET route handler returning an `ImageResponse`; the
// signed `token` (verified here) carries the learner name + variant, so it
// renders for a logged-out crawler and can't be forged. Every failure path falls
// back to a valid, on-brand PNG — a crawler's fetch must never 500.
//
// Design (frontend-design): a credential "instrument panel" on the brand palette,
// its signature a verification SEAL fusing a wax-seal with a PCB instrument dial
// (concentric gold rings + a bezel of radial ticks) around a ★ (cert) / ✓ (done).
import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { verifyCardToken, type CardClaims } from "@/lib/certificate-token";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens (inline so the route is self-contained). Source: globals.css @theme.
const DEEP_SPACE = "#08090d";
const BG_2 = "#0f1018";
const COMMAND_GOLD = "#c8963e";
const GOLD_LIGHT = "#e8b865";
const PANEL_BORDER = "#3a3f50";
const WHITE = "#ffffff";
const MUTED = "#9aa0ad";
const SANS =
  "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";

async function resolveBoard(slug: string): Promise<string> {
  try {
    const p = await db.project.findUnique({ where: { slug }, select: { name: true } });
    return p?.name ?? "a real board";
  } catch {
    return "a real board";
  }
}

// Filled star (cert) / check (done) drawn as SVG paths — system fonts in satori
// lack the ★/✓ glyphs (they render as tofu), so the mark is vector, not text.
const STAR_PATH =
  "M12 .6l3.7 7.4 8.2 1.2-5.9 5.8 1.4 8.2L12 26.9 4.7 23.2l1.4-8.2L.1 9.2l8.2-1.2z";
const CHECK_PATH = "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z";

// The verification seal: concentric rings + a bezel of radial ticks + a center
// mark. The one bold, subject-specific element (wax-seal × PCB dial).
function Seal({ isCert }: { isCert: boolean }) {
  const ticks = Array.from({ length: 24 });
  return (
    <div style={{ position: "relative", width: 210, height: 210, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* bezel ticks */}
      {ticks.map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: i % 2 === 0 ? 3 : 2,
            height: i % 2 === 0 ? 12 : 7,
            backgroundColor: i % 2 === 0 ? COMMAND_GOLD : PANEL_BORDER,
            transform: `rotate(${i * 15}deg) translateY(-98px)`,
            transformOrigin: "center",
          }}
        />
      ))}
      {/* outer ring */}
      <div style={{ position: "absolute", width: 170, height: 170, borderRadius: 170, border: `2px solid ${COMMAND_GOLD}` }} />
      {/* inner ring */}
      <div style={{ position: "absolute", width: 134, height: 134, borderRadius: 134, border: `1px solid ${PANEL_BORDER}` }} />
      {/* center disc + mark */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 134, height: 134, borderRadius: 134, backgroundImage: `radial-gradient(circle at 50% 35%, ${BG_2} 0%, ${DEEP_SPACE} 70%)` }}>
        <svg width="56" height="56" viewBox={isCert ? "0 0 24 27" : "0 0 24 24"} fill={GOLD_LIGHT}>
          <path d={isCert ? STAR_PATH : CHECK_PATH} />
        </svg>
        <div style={{ display: "flex", marginTop: 8, fontSize: 15, letterSpacing: 6, color: COMMAND_GOLD, fontWeight: 700 }}>OTD</div>
      </div>
    </div>
  );
}

function Card({ claims, board }: { claims: CardClaims; board: string }) {
  const isCert = claims.variant === "cert";
  const eyebrow = isCert ? "Verified Certificate of Achievement" : "Lesson Complete";
  const footLeft =
    isCert && typeof claims.score === "number" && typeof claims.total === "number"
      ? `Score ${claims.score}/${claims.total} · Passed`
      : "Hands-on hardware";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: DEEP_SPACE,
        backgroundImage: `radial-gradient(1200px 700px at 78% -12%, ${BG_2} 0%, ${DEEP_SPACE} 62%)`,
        padding: "60px 72px",
        fontFamily: SANS,
        color: WHITE,
      }}
    >
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center", fontSize: 28, letterSpacing: 5, fontWeight: 700, textTransform: "uppercase" }}>
        <span style={{ color: WHITE }}>One Thousand Drones&nbsp;</span>
        <span style={{ color: COMMAND_GOLD }}>Academy</span>
      </div>

      {/* Body: text left, seal right */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: GOLD_LIGHT }}>
            // {eyebrow}
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 78, lineHeight: 1.02, fontWeight: 800, letterSpacing: -1, color: WHITE }}>
            {claims.name}
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 26, color: MUTED }}>
            {isCert ? "for building the" : "built a real board:"}
          </div>
          <div style={{ display: "flex", marginTop: 4, fontSize: 40, fontWeight: 700, color: COMMAND_GOLD, maxWidth: 700 }}>
            {board}
          </div>
        </div>
        <Seal isCert={isCert} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 3, width: 200, backgroundColor: COMMAND_GOLD, marginBottom: 16 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, letterSpacing: 2, textTransform: "uppercase", color: MUTED }}>
          <span>{footLeft}</span>
          <span style={{ color: PANEL_BORDER }}>academy.onethousanddrones.com</span>
        </div>
      </div>

      {/* Hairline frame */}
      <div style={{ position: "absolute", top: 22, left: 22, right: 22, bottom: 22, border: `1px solid ${PANEL_BORDER}`, borderRadius: 16 }} />
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
    // Invalid/forged token → a neutral branded card, never a 500.
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: DEEP_SPACE, color: COMMAND_GOLD, fontFamily: SANS, fontSize: 40, letterSpacing: 4, textTransform: "uppercase" }}>
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
