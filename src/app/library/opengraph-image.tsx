// Open Graph card for the Library index (/library). The landing had no
// opengraph-image of its own and the root card is not inherited across the
// segment boundary, so shares of /library were blank. Text-only branded FW7
// card (no DB, no file reads) so it can never throw.
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
export const alt = "One Thousand Drones Academy — Library";

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
          <Eyebrow tri>Library</Eyebrow>
          <CardTitle size={78} maxWidth={820}>
            Reference Guides
          </CardTitle>
        </div>
      </div>
      <DefaultFooter />
    </Field>,
  );
}
