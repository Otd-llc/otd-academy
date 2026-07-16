// Open Graph card for the Tools index (/tools). The landing had no card of its
// own, so shares were blank. Text-only branded FW7 card (no DB, no file reads).
import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Eyebrow,
  CardTitle,
  DefaultFooter,
} from "@/lib/og/card";
import { SIZE } from "@/lib/og/tokens";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "One Thousand Drones Academy — Calculators";

export default function Image() {
  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          <Eyebrow tri>Tools</Eyebrow>
          <CardTitle size={78} maxWidth={820}>
            Electronics Calculators
          </CardTitle>
        </div>
      </div>
      <DefaultFooter />
    </Field>,
  );
}
