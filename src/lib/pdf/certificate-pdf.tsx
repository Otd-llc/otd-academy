// The premium PDF certificate (landscape A4) — classic engraved look (Crimson Text
// serif + Great Vibes script, both bundled). ONE emblem (the OTD bee, struck only
// as the seal). Gold is rationed (frame · subtitle · rule · seal); the board name
// reads in ink. Ornate double-bracket corners with a struck diamond; a large, faint
// bee watermark as paper texture. Date · Seal · Signature footer.
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  Circle,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CardClaims } from "@/lib/certificate-token";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX, CERT_SKILLS } from "@/lib/pdf/certificate-content";

const IVORY = "#faf7f0";
const INK = "#14181f";
const GOLD = "#b5882e";
const MUTED = "#6b7280";
const FAINT = "#9aa0ad";

const s = StyleSheet.create({
  page: { backgroundColor: IVORY, color: INK },
  frameOuter: { position: "absolute", top: 18, left: 18, right: 18, bottom: 18, border: `2pt solid ${GOLD}` },
  frameInner: { position: "absolute", top: 25, left: 25, right: 25, bottom: 25, border: `0.6pt solid ${MUTED}` },
  frameBeaded: { position: "absolute", top: 38, left: 38, right: 38, bottom: 38, borderWidth: 0.7, borderStyle: "dotted", borderColor: GOLD },
  wmWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  content: { flexGrow: 1, paddingVertical: 50, paddingHorizontal: 80, alignItems: "center", justifyContent: "space-between" },
  wordmark: { fontFamily: "Helvetica", fontSize: 11, letterSpacing: 5, color: MUTED, textTransform: "uppercase" },
  titleWrap: { alignItems: "center", marginTop: 12 },
  title: { fontFamily: "Serif", fontSize: 44, letterSpacing: 3, color: INK, textTransform: "uppercase" },
  titleSub: { fontFamily: "Serif", fontSize: 16, letterSpacing: 6, color: GOLD, textTransform: "uppercase", marginTop: 3 },
  middle: { alignItems: "center" },
  presented: { fontFamily: "Helvetica", fontSize: 10, letterSpacing: 3, color: FAINT, textTransform: "uppercase", marginBottom: 6 },
  name: { fontFamily: "Script", fontSize: 64, color: INK },
  nameRule: { width: 330, height: 0.8, backgroundColor: GOLD, marginTop: 8, marginBottom: 18 },
  lead: { fontFamily: "Serif", fontSize: 13, fontStyle: "italic", color: MUTED },
  board: { fontFamily: "Serif", fontSize: 23, color: INK, marginTop: 4 },
  score: { fontFamily: "Helvetica", fontSize: 8.5, letterSpacing: 2, color: FAINT, textTransform: "uppercase", marginTop: 12 },
  skillsLabel: { fontFamily: "Helvetica", fontSize: 7, letterSpacing: 2, color: FAINT, textTransform: "uppercase", marginTop: 22, marginBottom: 5 },
  skills: { fontFamily: "Serif", fontSize: 9.5, color: MUTED },
  footer: { width: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  col: { width: 230, alignItems: "center" },
  dateText: { fontFamily: "Serif", fontSize: 18, color: INK, marginBottom: 3 },
  sigText: { fontFamily: "Script", fontSize: 26, color: INK, marginBottom: 1 },
  footRule: { width: 170, height: 0.8, backgroundColor: INK, marginBottom: 5 },
  footLabel: { fontFamily: "Helvetica", fontSize: 8, letterSpacing: 2, color: MUTED, textTransform: "uppercase" },
  provenance: { position: "absolute", bottom: 30, left: 0, right: 0, textAlign: "center", fontFamily: "Helvetica", fontSize: 7.5, letterSpacing: 1.5, color: FAINT, textTransform: "uppercase" },
});

// Ornate corner: an outer + inner L-bracket and a struck diamond at the vertex.
function Corner({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const top = corner[0] === "t";
  const left = corner[1] === "l";
  const pos = (o: number) => ({
    position: "absolute" as const,
    ...(top ? { top: o } : { bottom: o }),
    ...(left ? { left: o } : { right: o }),
  });
  const bw = (tw: number) => ({
    ...(top ? { borderTopWidth: tw } : { borderBottomWidth: tw }),
    ...(left ? { borderLeftWidth: tw } : { borderRightWidth: tw }),
    borderColor: GOLD,
  });
  return (
    <>
      <View style={{ ...pos(30), width: 34, height: 34, ...bw(1.4) }} />
      <View style={{ ...pos(37), width: 19, height: 19, ...bw(0.9) }} />
      <View style={{ ...pos(27), width: 7, height: 7, backgroundColor: GOLD, transform: "rotate(45deg)" }} />
    </>
  );
}

// A struck medallion: a clean gold rim with a beaded bezel, the OTD bee large and
// integrated as the device (the house mark, once).
function Seal() {
  const beads = Array.from({ length: 32 });
  return (
    <View style={{ width: 110, height: 110, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <Svg width={110} height={110} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        <Path d="M50 5 A45 45 0 1 1 49.99 5 Z" stroke={GOLD} strokeWidth={1.6} fill="none" />
        {beads.map((_, i) => {
          const a = (i * 2 * Math.PI) / 32;
          const r = 41;
          return <Circle key={i} cx={50 + r * Math.sin(a)} cy={50 - r * Math.cos(a)} r={0.9} fill={GOLD} />;
        })}
        <Path d="M50 13 A37 37 0 1 1 49.99 13 Z" stroke={MUTED} strokeWidth={0.6} fill="none" />
      </Svg>
      <Svg width={80} height={77} viewBox={BRANDMARK_VIEWBOX}>
        <Path d={BRANDMARK_PATH} fill={GOLD} />
      </Svg>
    </View>
  );
}

function formatDate(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function CertificatePdf({
  claims,
  board,
  certId,
}: {
  claims: CardClaims;
  board: string;
  certId: string;
}) {
  const isCert = claims.variant === "cert";
  const hasScore = isCert && typeof claims.score === "number" && typeof claims.total === "number";
  return (
    <Document title={`${claims.name} — Certificate of ${isCert ? "Achievement" : "Completion"}`} author="One Thousand Drones Academy">
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* large, faint bee watermark — paper texture, behind everything */}
        <View style={s.wmWrap}>
          <Svg width={500} height={478} viewBox={BRANDMARK_VIEWBOX}>
            <Path d={BRANDMARK_PATH} fill={GOLD} fillOpacity={0.035} />
          </Svg>
        </View>
        <View style={s.frameOuter} />
        <View style={s.frameInner} />
        <View style={s.frameBeaded} />
        <Corner corner="tl" />
        <Corner corner="tr" />
        <Corner corner="bl" />
        <Corner corner="br" />

        <View style={s.content}>
          <View style={{ alignItems: "center" }}>
            <Text style={s.wordmark}>One Thousand Drones Academy</Text>
            <View style={s.titleWrap}>
              <Text style={s.title}>Certificate</Text>
              <Text style={s.titleSub}>of {isCert ? "Achievement" : "Completion"}</Text>
            </View>
          </View>

          <View style={s.middle}>
            <Text style={s.presented}>This certifies that</Text>
            <Text style={s.name}>{claims.name}</Text>
            <View style={s.nameRule} />
            <Text style={s.lead}>
              {isCert ? "earned this certificate for designing and building" : "designed and built a real board:"}
            </Text>
            <Text style={s.board}>{board}</Text>
            {hasScore ? (
              <Text style={s.score}>Final exam · {claims.score}/{claims.total} · Passed</Text>
            ) : null}
            <Text style={s.skillsLabel}>— covered in this build —</Text>
            <Text style={s.skills}>{CERT_SKILLS.join("  ·  ")}</Text>
          </View>

          <View style={s.footer}>
            <View style={s.col}>
              <Text style={s.dateText}>{formatDate(claims.date)}</Text>
              <View style={s.footRule} />
              <Text style={s.footLabel}>Date</Text>
            </View>
            <Seal />
            <View style={s.col}>
              <Text style={s.sigText}>Joshua Tollette</Text>
              <View style={s.footRule} />
              <Text style={s.footLabel}>Founder · One Thousand Drones</Text>
            </View>
          </View>
        </View>

        <Text style={s.provenance}>
          ID {certId} · Verify at academy.onethousanddrones.com/verify
        </Text>
      </Page>
    </Document>
  );
}
