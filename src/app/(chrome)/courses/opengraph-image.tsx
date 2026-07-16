// Open Graph card for the Courses index (/courses). Same reason as the Library
// index: the landing had no card of its own, so shares were blank. Text-only
// branded FW7 card (no DB, no file reads) so it can never throw.
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
export const alt = "One Thousand Drones Academy — Courses";

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
          <Eyebrow tri>Courses</Eyebrow>
          <CardTitle size={78} maxWidth={820}>
            Build it for real
          </CardTitle>
        </div>
      </div>
      <DefaultFooter />
    </Field>,
  );
}
