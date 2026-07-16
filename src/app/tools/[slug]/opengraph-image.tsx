// Dynamic Open Graph image for an EE calculator (/tools/[slug]).
//
// The instrument variant: a Saira exemplar readout is the hero, the tool's short
// name beneath. The exemplar values are illustrative (labelled "example"), keyed
// by slug — the tools are static config, not DB. Unknown slug → text-only
// fallback. No I/O, so it can't throw; the try/catch guards only param access.

import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Eyebrow,
  CardTitle,
  SairaReadout,
  ShareCard,
  DefaultFooter,
} from "@/lib/og/card";
import { SIZE } from "@/lib/og/tokens";
import { getTool } from "@/lib/tools/registry";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy calculator";

type Params = { slug: string };

// Illustrative readouts (NOT computed answers — the label says "example"). One
// per calculator so the card carries the instrument look.
const EXEMPLAR: Record<string, { value: string; unit: string; label: string }> = {
  "lipo-battery-runtime": { value: "8.5", unit: "h", label: "example runtime" },
  "ws2812-power-supply": { value: "2.42", unit: "A", label: "example supply" },
  "led-series-resistor": { value: "330", unit: "Ω", label: "example series R" },
  "voltage-divider": { value: "3.3", unit: "V", label: "example Vout" },
  "ldo-headroom": { value: "0.53", unit: "W", label: "example dissipation" },
  "rc-filter-cutoff": { value: "1.6", unit: "kHz", label: "example cutoff" },
  "pcb-trace-width": { value: "0.4", unit: "mm", label: "example trace width" },
  "resistor-power": { value: "0.25", unit: "W", label: "example rating" },
  "battery-watt-hours": { value: "37", unit: "Wh", label: "example capacity" },
};

export default async function Image({ params }: { params: Promise<Params> }) {
  let slug = "";
  try {
    slug = (await params).slug ?? "";
  } catch {
    // keep empty
  }

  const tool = getTool(slug);
  const readout = EXEMPLAR[slug];

  // No exemplar (a new tool not yet mapped) → the plain FW7 text card.
  if (!tool || !readout) {
    return renderCard(
      <ShareCard
        eyebrow="Calculator"
        title={tool?.hero ?? "Electronics calculators"}
        titleSize={80}
      />,
    );
  }

  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <Eyebrow tri>Calculator</Eyebrow>
        <SairaReadout
          value={readout.value}
          unit={readout.unit}
          label={readout.label}
        />
        <div style={{ display: "flex", marginTop: 26 }}>
          <CardTitle size={58} maxWidth={820}>
            {tool.hero}
          </CardTitle>
        </div>
      </div>
      <DefaultFooter />
    </Field>,
  );
}
