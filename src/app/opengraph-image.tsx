// Root default Open Graph image (Task 3).
//
// Next App Router applies this to every route WITHOUT its own opengraph-image,
// so it is the single biggest coverage win: every bare academy URL now shares a
// branded card instead of nothing. It carries the locked FW7 look (ivory-ghost
// brand mark on the open deep-space field) as the brand statement: the wordmark
// is the hero, no per-route data, so nothing can make it throw.

import { renderCard, Field, IvoryGhost, DefaultFooter } from "@/lib/og/card";
import { OG, SIZE } from "@/lib/og/tokens";

export const alt = "One Thousand Drones Academy";
export const size = SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost width={720} opacity={0.08} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Space Mono",
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: OG.GOLD_LIGHT,
            marginBottom: 26,
          }}
        >
          Learn by building
        </div>
        {/* Wordmark as the hero. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Bebas Neue",
            fontSize: 104,
            lineHeight: 0.92,
            letterSpacing: 2,
          }}
        >
          <div style={{ display: "flex", color: OG.TITLE }}>
            ONE THOUSAND DRONES
          </div>
          <div style={{ display: "flex", color: OG.COMMAND_GOLD }}>ACADEMY</div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontFamily: "Space Mono",
            fontSize: 26,
            letterSpacing: 1,
            color: OG.TEXT,
          }}
        >
          Design and build real hardware, one board at a time.
        </div>
      </div>
      <DefaultFooter />
    </Field>,
  );
}
