// Smoke test for the share-card kit (Task 1).
//
// Renders a minimal card through the real ImageResponse seam and asserts it
// produces a valid PNG. Pure Node — no DB import, so this lands in vitest's
// "unit" project (no Neon branch lease). This is the kit's floor: if the fonts
// or Satori pipeline break, this goes red before any route does.
//
// NOTE: .tsx (not the plan's .ts) because the render uses JSX. The vitest include
// glob is /\.test\.tsx?$/, so it's picked up either way.

import { describe, it, expect } from "vitest";
import { renderCard, CardShell, Eyebrow, CardTitle, SairaReadout, HexBadge } from "@/lib/og/card";

describe("og card kit", () => {
  it("renders a branded 1200x630 PNG through renderCard", async () => {
    const res = await renderCard(
      <CardShell>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Eyebrow>Smoke Test</Eyebrow>
          <CardTitle>ESP32-S3 USB-C Breakout Board</CardTitle>
        </div>
      </CardShell>,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");

    const buf = Buffer.from(await res.arrayBuffer());
    // A real rendered PNG is many KB; a broken/empty render would be tiny.
    expect(buf.length).toBeGreaterThan(10_000);
    // PNG magic bytes: 89 50 4E 47.
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("renders the numeral + hex primitives without throwing", async () => {
    const res = await renderCard(
      <CardShell footer={null}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <HexBadge n={3} />
          <div style={{ display: "flex", marginLeft: 40 }}>
            <SairaReadout value="42" unit="min" label="LiPo runtime" />
          </div>
        </div>
      </CardShell>,
    );
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(10_000);
  });
});
