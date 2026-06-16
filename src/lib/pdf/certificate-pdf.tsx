// The premium PDF certificate (landscape A4) — the real downloadable credential.
// Built with @react-pdf/renderer's built-in fonts (Times serif for the title +
// recipient name, Helvetica for labels) so the serverless route needs NO font
// fetch/bundle. The brand comes through the ivory/ink/gold palette, the wax-seal ×
// PCB instrument-dial seal, the fine double border, and the verification line.
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Circle,
  Line,
  Path,
  StyleSheet,
} from "@react-pdf/renderer";
import type { CardClaims } from "@/lib/certificate-token";
import { BRANDMARK_PATH, BRANDMARK_VIEWBOX, CERT_SKILLS } from "@/lib/pdf/certificate-content";

const IVORY = "#faf7f0";
const INK = "#0d1117";
const GOLD = "#b5882e"; // deepened for contrast on ivory (paper-safe)
const MUTED = "#6b7280";

const s = StyleSheet.create({
  page: { backgroundColor: IVORY, fontFamily: "Helvetica", color: INK },
  borderOuter: { position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: `1.5pt solid ${GOLD}` },
  borderInner: { position: "absolute", top: 22, left: 22, right: 22, bottom: 22, border: `0.6pt solid ${MUTED}` },
  content: { flexGrow: 1, paddingVertical: 40, paddingHorizontal: 64, alignItems: "center", justifyContent: "space-between" },
  header: { alignItems: "center" },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 4, color: INK, marginTop: 8 },
  wordmarkGold: { color: GOLD },
  skillsWrap: { alignItems: "center", marginTop: 14 },
  skillsLabel: { fontFamily: "Helvetica", fontSize: 8, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginBottom: 4 },
  skills: { fontFamily: "Helvetica", fontSize: 8.5, letterSpacing: 0.3, color: INK },
  middle: { alignItems: "center" },
  title: { fontFamily: "Times-Roman", fontSize: 30, letterSpacing: 1, color: INK, marginBottom: 18 },
  lead: { fontFamily: "Times-Italic", fontSize: 12.5, color: MUTED, marginBottom: 8 },
  name: { fontFamily: "Times-Bold", fontSize: 44, color: INK, marginBottom: 10 },
  nameRule: { width: 280, height: 0.8, backgroundColor: GOLD, marginBottom: 14 },
  board: { fontFamily: "Times-Roman", fontSize: 21, color: GOLD, marginBottom: 6 },
  score: { fontFamily: "Helvetica", fontSize: 10, letterSpacing: 2, color: MUTED, textTransform: "uppercase", marginTop: 4 },
  footer: { width: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  col: { width: 230 },
  colRight: { width: 230, alignItems: "flex-end" },
  sigName: { fontFamily: "Times-Italic", fontSize: 22, color: INK, marginBottom: 2 },
  sigLine: { width: 180, height: 0.8, backgroundColor: INK, marginBottom: 5 },
  label: { fontFamily: "Helvetica", fontSize: 8.5, letterSpacing: 1.5, color: MUTED, textTransform: "uppercase" },
  metaValue: { fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 1, color: INK, marginBottom: 4 },
});

// The seal: the brand's own device — the OTD bee struck inside a fine bezel ring,
// the way a coin or wax seal bears the house mark. The same emblem as the header,
// twice, binds the document to its house (see the design philosophy note).
function Seal() {
  const ticks = Array.from({ length: 24 });
  return (
    <View style={{ width: 90, height: 90, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <Svg width={90} height={90} viewBox="0 0 100 100" style={{ position: "absolute", top: 0, left: 0 }}>
        {ticks.map((_, i) => {
          const a = (i * 15 * Math.PI) / 180;
          const r1 = 48;
          const r2 = i % 2 === 0 ? 42 : 45;
          const x1 = 50 + r1 * Math.sin(a);
          const y1 = 50 - r1 * Math.cos(a);
          const x2 = 50 + r2 * Math.sin(a);
          const y2 = 50 - r2 * Math.cos(a);
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 === 0 ? GOLD : MUTED} strokeWidth={i % 2 === 0 ? 1.4 : 0.7} />;
        })}
        <Circle cx={50} cy={50} r={39} stroke={GOLD} strokeWidth={1.4} fill="none" />
        <Circle cx={50} cy={50} r={32} stroke={MUTED} strokeWidth={0.6} fill="none" />
      </Svg>
      <Svg width={42} height={40} viewBox={BRANDMARK_VIEWBOX}>
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
    <Document title={`${claims.name} — ${isCert ? "Certificate of Achievement" : "Lesson Complete"}`} author="One Thousand Drones Academy">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.borderOuter} />
        <View style={s.borderInner} />
        <View style={s.content}>
          <View style={s.header}>
            <Svg width={40} height={38} viewBox={BRANDMARK_VIEWBOX}>
              <Path d={BRANDMARK_PATH} fill={GOLD} />
            </Svg>
            <Text style={s.wordmark}>
              ONE THOUSAND DRONES <Text style={s.wordmarkGold}>ACADEMY</Text>
            </Text>
          </View>

          <View style={s.middle}>
            <Text style={s.title}>Certificate of {isCert ? "Achievement" : "Completion"}</Text>
            <Text style={s.lead}>This certifies that</Text>
            <Text style={s.name}>{claims.name}</Text>
            <View style={s.nameRule} />
            <Text style={s.lead}>
              {isCert ? "earned this certificate for designing and building" : "designed and built a real board:"}
            </Text>
            <Text style={s.board}>{board}</Text>
            {hasScore ? (
              <Text style={s.score}>Final exam · {claims.score}/{claims.total} · Passed</Text>
            ) : null}
            <View style={s.skillsWrap}>
              <Text style={s.skillsLabel}>— covered in this build —</Text>
              <Text style={s.skills}>{CERT_SKILLS.join("  ·  ")}</Text>
            </View>
          </View>

          <View style={s.footer}>
            <View style={s.col}>
              <Text style={s.sigName}>Joshua Tollette</Text>
              <View style={s.sigLine} />
              <Text style={s.label}>Founder · One Thousand Drones</Text>
            </View>
            <Seal />
            <View style={s.colRight}>
              <Text style={s.metaValue}>{formatDate(claims.date)}</Text>
              <Text style={s.metaValue}>ID {certId}</Text>
              <Text style={s.label}>verify at academy.onethousanddrones.com/verify</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
