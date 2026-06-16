// The premium PDF certificate (landscape A4) — redesigned per the "Engraved
// Provenance" design note + classic-certificate references: ONE emblem (the OTD
// bee, struck only as the seal), an elegant script recipient name (Great Vibes), a
// Garamond serif title, a gold frame with corner ornaments, a faint bee
// watermark, and the classic Date · Seal · Signature footer. Fonts are bundled
// (cert-fonts) so the serverless route needs no font fetch.
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CardClaims } from "@/lib/certificate-token";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX, CERT_SKILLS } from "@/lib/pdf/certificate-content";

const IVORY = "#faf7f0";
const INK = "#14181f";
const GOLD = "#b5882e";
const MUTED = "#6b7280";

const s = StyleSheet.create({
  page: { backgroundColor: IVORY, color: INK },
  // Frame
  frameOuter: { position: "absolute", top: 18, left: 18, right: 18, bottom: 18, border: `2pt solid ${GOLD}` },
  frameInner: { position: "absolute", top: 25, left: 25, right: 25, bottom: 25, border: `0.6pt solid ${MUTED}` },
  // Watermark layer
  wmWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  // Content
  content: { flexGrow: 1, paddingVertical: 44, paddingHorizontal: 78, alignItems: "center", justifyContent: "space-between" },
  wordmark: { fontFamily: "Helvetica", fontSize: 11, letterSpacing: 5, color: MUTED, textTransform: "uppercase" },
  titleWrap: { alignItems: "center", marginTop: 14 },
  title: { fontFamily: "Serif", fontSize: 46, letterSpacing: 6, color: INK, textTransform: "uppercase" },
  titleSub: { fontFamily: "Serif", fontSize: 17, letterSpacing: 8, color: GOLD, textTransform: "uppercase", marginTop: 2 },
  middle: { alignItems: "center" },
  presented: { fontFamily: "Helvetica", fontSize: 10, letterSpacing: 3, color: MUTED, textTransform: "uppercase" },
  name: { fontFamily: "Script", fontSize: 62, color: INK, marginTop: 2, marginBottom: -2 },
  nameRule: { width: 320, height: 0.8, backgroundColor: GOLD, marginTop: 4, marginBottom: 12 },
  lead: { fontFamily: "Serif", fontSize: 13, fontStyle: "italic", color: MUTED },
  board: { fontFamily: "Serif", fontSize: 22, color: GOLD, marginTop: 3 },
  score: { fontFamily: "Helvetica", fontSize: 9, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginTop: 8 },
  skillsLabel: { fontFamily: "Helvetica", fontSize: 7.5, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginTop: 14, marginBottom: 4 },
  skills: { fontFamily: "Serif", fontSize: 10.5, color: INK },
  // Footer
  footer: { width: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  col: { width: 230, alignItems: "center" },
  scriptSmall: { fontFamily: "Script", fontSize: 22, color: INK, marginBottom: 1 },
  footRule: { width: 170, height: 0.8, backgroundColor: INK, marginBottom: 5 },
  footLabel: { fontFamily: "Helvetica", fontSize: 8, letterSpacing: 2, color: MUTED, textTransform: "uppercase" },
  provenance: { position: "absolute", bottom: 34, left: 0, right: 0, textAlign: "center", fontFamily: "Helvetica", fontSize: 7.5, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase" },
});

function CornerBrackets() {
  const L = 24;
  const base = { position: "absolute" as const, width: L, height: L, borderColor: GOLD };
  return (
    <>
      <View style={{ ...base, top: 30, left: 30, borderTopWidth: 1.2, borderLeftWidth: 1.2 }} />
      <View style={{ ...base, top: 30, right: 30, borderTopWidth: 1.2, borderRightWidth: 1.2 }} />
      <View style={{ ...base, bottom: 30, left: 30, borderBottomWidth: 1.2, borderLeftWidth: 1.2 }} />
      <View style={{ ...base, bottom: 30, right: 30, borderBottomWidth: 1.2, borderRightWidth: 1.2 }} />
    </>
  );
}

// The seal: the OTD bee struck inside a fine bezel ring — the house mark, used
// once, as the seal (it is NOT repeated as a top logo).
function Seal() {
  const ticks = Array.from({ length: 24 });
  return (
    <View style={{ width: 92, height: 92, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <Svg width={92} height={92} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        {ticks.map((_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          const r1 = 48;
          const r2 = i % 2 === 0 ? 42 : 45;
          return (
            <Path
              key={i}
              d={`M ${50 + r2 * Math.sin(a)} ${50 - r2 * Math.cos(a)} L ${50 + r1 * Math.sin(a)} ${50 - r1 * Math.cos(a)}`}
              stroke={i % 2 === 0 ? GOLD : MUTED}
              strokeWidth={i % 2 === 0 ? 1.4 : 0.7}
            />
          );
        })}
        <Path d="M50 11 A39 39 0 1 1 49.99 11 Z" stroke={GOLD} strokeWidth={1.4} fill="none" />
        <Path d="M50 18 A32 32 0 1 1 49.99 18 Z" stroke={MUTED} strokeWidth={0.6} fill="none" />
      </Svg>
      <Svg width={44} height={42} viewBox={BRANDMARK_VIEWBOX}>
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
        {/* faint bee watermark, behind everything */}
        <View style={s.wmWrap}>
          <Svg width={300} height={287} viewBox={BRANDMARK_VIEWBOX}>
            <Path d={BRANDMARK_PATH} fill={GOLD} fillOpacity={0.05} />
          </Svg>
        </View>
        <View style={s.frameOuter} />
        <View style={s.frameInner} />
        <CornerBrackets />

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
              <Text style={s.scriptSmall}>{formatDate(claims.date)}</Text>
              <View style={s.footRule} />
              <Text style={s.footLabel}>Date</Text>
            </View>
            <Seal />
            <View style={s.col}>
              <Text style={s.scriptSmall}>Joshua Tollette</Text>
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
