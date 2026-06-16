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

const IVORY = "#faf7f0";
const INK = "#0d1117";
const GOLD = "#b5882e"; // deepened for contrast on ivory (paper-safe)
const MUTED = "#6b7280";

const STAR =
  "M50 27 L57.3 41.8 L73.6 44.2 L61.8 55.7 L64.6 71.9 L50 64.3 L35.4 71.9 L38.2 55.7 L26.4 44.2 L42.7 41.8 Z";
const CHECK = "M38 51 L46 59 L64 40 L68.5 44.5 L46 68 L33.5 55.5 Z";

const s = StyleSheet.create({
  page: { backgroundColor: IVORY, fontFamily: "Helvetica", color: INK },
  borderOuter: { position: "absolute", top: 16, left: 16, right: 16, bottom: 16, border: `1.5pt solid ${GOLD}` },
  borderInner: { position: "absolute", top: 22, left: 22, right: 22, bottom: 22, border: `0.6pt solid ${MUTED}` },
  content: { flexGrow: 1, paddingVertical: 46, paddingHorizontal: 64, alignItems: "center", justifyContent: "space-between" },
  wordmark: { fontFamily: "Helvetica-Bold", fontSize: 13, letterSpacing: 4, color: INK },
  wordmarkGold: { color: GOLD },
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

function Seal({ isCert }: { isCert: boolean }) {
  const ticks = Array.from({ length: 24 });
  return (
    <Svg width={86} height={86} viewBox="0 0 100 100">
      {ticks.map((_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        const r1 = 47;
        const r2 = i % 2 === 0 ? 41 : 44;
        const x1 = 50 + r1 * Math.sin(a);
        const y1 = 50 - r1 * Math.cos(a);
        const x2 = 50 + r2 * Math.sin(a);
        const y2 = 50 - r2 * Math.cos(a);
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 2 === 0 ? GOLD : MUTED} strokeWidth={i % 2 === 0 ? 1.4 : 0.7} />;
      })}
      <Circle cx={50} cy={50} r={37} stroke={GOLD} strokeWidth={1.5} fill="none" />
      <Circle cx={50} cy={50} r={30} stroke={MUTED} strokeWidth={0.6} fill="none" />
      <Path d={isCert ? STAR : CHECK} fill={GOLD} />
    </Svg>
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
          <Text style={s.wordmark}>
            ONE THOUSAND DRONES <Text style={s.wordmarkGold}>ACADEMY</Text>
          </Text>

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
          </View>

          <View style={s.footer}>
            <View style={s.col}>
              <Text style={s.sigName}>Joshua Tollette</Text>
              <View style={s.sigLine} />
              <Text style={s.label}>Founder · One Thousand Drones</Text>
            </View>
            <Seal isCert={isCert} />
            <View style={s.colRight}>
              <Text style={s.metaValue}>{formatDate(claims.date)}</Text>
              <Text style={s.metaValue}>ID {certId}</Text>
              <Text style={s.label}>verify · academy.onethousanddrones.com</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
