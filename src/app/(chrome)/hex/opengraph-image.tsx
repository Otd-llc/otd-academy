// Open Graph card for /hex.
//
// THIS SURFACE NEEDED ONE MORE THAN ANY OTHER. `/hex` is the CC BY attribution
// target: every published .3mf/.stl/.step in every release carries a LICENSE.txt
// pointing at it, so the link travels wherever the geometry does, and until now
// every one of those shares rendered whatever the site default happened to be.
//
// NUMERALS COME FROM `@/lib/hex-spec`, never typed in here. The page's own rule
// is that a maker must never find two different numbers for the same dimension
// across the page and the build sheet in their hand, and a share card is one
// more place that can disagree. HEX_PITCH_MM is itself derived from the
// circumradius and the gap, so the card cannot drift from the geometry either.
//
// The part count is deliberately absent. hex-spec says in as many words that it
// is NOT page copy: the published set grows when a part is added, so printing it
// anywhere a test does not check is a promise the surface cannot keep.
//
// Composes Field + primitives rather than `ShareCard`, because this card has a
// numeral hero, which is the documented reason to compose directly.
import {
  renderCard,
  Field,
  IvoryGhost,
  Wordmark,
  Center,
  Eyebrow,
  CardTitle,
  SairaReadout,
  DefaultFooter,
} from "@/lib/og/card";
import { SIZE } from "@/lib/og/tokens";
import { HEX_LICENSE, HEX_PITCH_MM, HEX_RELEASE } from "@/lib/hex-spec";

export const size = SIZE;
export const contentType = "image/png";
export const alt = `Hex Cluster: a printable hex mounting standard, ${HEX_LICENSE.name}.`;

export default function Image() {
  return renderCard(
    <Field wash frame={false}>
      <IvoryGhost />
      <Wordmark />
      <Center>
        <Eyebrow tri>Open hardware release</Eyebrow>
        <CardTitle size={74} maxWidth={760}>
          Hex Cluster
        </CardTitle>
        <div style={{ display: "flex", marginTop: 28 }}>
          <SairaReadout
            value={HEX_PITCH_MM.toFixed(2)}
            unit="mm"
            label="cell pitch, centre to centre"
          />
        </div>
      </Center>
      {/* The licence rides on the card, because the people most likely to see
          this share arrived from an attribution line in someone else's file. */}
      <DefaultFooter tagline={`${HEX_LICENSE.name} · Release ${HEX_RELEASE}`} />
    </Field>,
  );
}
