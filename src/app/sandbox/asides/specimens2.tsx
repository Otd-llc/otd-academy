// SANDBOX ONLY — round 2. Variants of G5 (display-face question) and H4
// (display-face sign-off), exploring SUBTLE GRADIENT.
//
// The house bans gradient-as-accent: a soft gradient blob or a gradient-filled
// feature panel is the #1 AI-default tell. What it does NOT ban is the gradient
// vocabulary it already ships and uses:
//
//   .title-rule    a hairline with gold gradient across its left 60%, fading to
//                  transparent. Every PageHeader opens with it.
//   .section-band  a 90deg gold wash, 10% → 2% → transparent, over a gold
//                  hairline. Used on the project-detail section dividers.
//
// So every gradient below is drawn on a RULE or as a WASH THAT DIES, never as a
// fill, a glow, or an accent colour. The rule is the thing that fades; the block
// underneath stays bare deep-space. That is the clever version and it is already
// house style, rather than a new idiom smuggled in.
//
// Every stop is color-mix() over a token, so the whole set re-themes.

import { T, type AsideProps, type ExitProps } from "./specimens";

const BODY = "whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-muted";
const Q = "font-display text-2xl leading-none tracking-wide text-title";
const gold = (pct: number) => `color-mix(in srgb, var(--color-command-gold) ${pct}%, transparent)`;

// ═══ G5 variants — the display-face question ═══════════════════════════════

// G5a — the title-rule idiom at block scale. The question opens like a document
// opens: Bebas over a hairline whose gold burns out across the left 60%.
export function G5a({ label, body }: AsideProps) {
  return (
    <section className="my-7">
      <h4 className={Q}>{label}</h4>
      <div
        aria-hidden
        className="mt-2 h-px w-full"
        style={{ background: `linear-gradient(to right, ${gold(85)} 0%, ${gold(50)} 38%, ${gold(0)} 100%)` }}
      />
      <p className={`mt-3 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// G5b — the spine that falls away. A left rule that is gold where the answer
// starts and gone by the time it ends, so the thread visibly runs out instead of
// stopping dead. Reuses the Do block's spine vocabulary without its weight.
export function G5b({ label, body }: AsideProps) {
  return (
    <section className="my-7 flex gap-4">
      <span
        aria-hidden
        className="w-0.5 shrink-0 rounded-full"
        style={{ background: `linear-gradient(to bottom, ${gold(75)} 0%, ${gold(22)} 55%, ${gold(0)} 100%)` }}
      />
      <div>
        <h4 className={Q}>{label}</h4>
        <p className={`mt-2 ${BODY}`}><T text={body} /></p>
      </div>
    </section>
  );
}

// G5c — the underline hugs the words. The gradient is sized to the question, not
// the column, so a short question gets a short rule and the block never looks
// like a header bar. Fades out under the last few letters.
export function G5c({ label, body }: AsideProps) {
  return (
    <section className="my-7">
      <h4 className={`${Q} inline-block pb-1.5`}
        style={{
          borderBottom: "2px solid transparent",
          borderImage: `linear-gradient(to right, ${gold(90)} 0%, ${gold(55)} 55%, ${gold(0)} 100%) 1`,
        }}
      >
        {label}
      </h4>
      <p className={`mt-3 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// G5d — the .section-band wash, scoped to the question line only. The wash dies
// by 60% and the body sits on bare field, so it reads as a tinted seam rather
// than a filled card. This is the closest option to the "filled box" the system
// rejects: it earns its place only because the wash never reaches the body and
// tops out at 9%.
export function G5d({ label, body }: AsideProps) {
  return (
    <section className="my-7">
      <div
        className="-mx-4 px-4 py-2"
        style={{
          background: `linear-gradient(90deg, ${gold(9)} 0%, ${gold(2)} 60%, ${gold(0)} 100%)`,
          borderBottom: `1px solid ${gold(18)}`,
        }}
      >
        <h4 className={Q}>{label}</h4>
      </div>
      <p className={`mt-3 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// G5e — a seam in the page. The rule above fades out at BOTH ends, so the block
// has no hard edge anywhere: it surfaces out of the page and sinks back.
export function G5e({ label, body }: AsideProps) {
  return (
    <section className="my-7">
      <div
        aria-hidden
        className="h-px w-full"
        style={{ background: `linear-gradient(to right, ${gold(0)} 0%, ${gold(60)} 22%, ${gold(60)} 78%, ${gold(0)} 100%)` }}
      />
      <h4 className={`${Q} mt-3`}>{label}</h4>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
    </section>
  );
}

// ═══ H4 variants — the display-face sign-off ═══════════════════════════════

// H4a — the flanking rule dissolves. Bebas at the left, and the rule beside it
// burns out to nothing, so the card ends by fading rather than by stopping.
export function H4a({ body, next }: ExitProps) {
  return (
    <section className="mt-10">
      <div className="flex items-center gap-3">
        <h4 className="shrink-0 font-display text-2xl leading-none tracking-wide text-title">
          Exit this stage
        </h4>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: `linear-gradient(to right, ${gold(70)} 0%, ${gold(0)} 100%)` }}
        />
      </div>
      <p className={`mt-3 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
        Next · {next}
      </p>
    </section>
  );
}

// H4b — reuse the REAL `.title-rule` class. The card closes with the exact
// divider every page opens with, which is the cheapest possible way to make the
// end of a stage feel like a document boundary.
export function H4b({ body, next }: ExitProps) {
  return (
    <section className="mt-10">
      <div className="title-rule" aria-hidden />
      <h4 className="font-display text-2xl leading-none tracking-wide text-title">
        Exit this stage
      </h4>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
        Next · {next}
      </p>
    </section>
  );
}

// H4c — the sign-off carries the numeral moment. Bebas title, dissolving rule,
// and the stage position in Saira: the one number on the card gets the signature
// face instead of being spelled out in mono.
export function H4c({ body, ord, of, next }: ExitProps) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-3">
        <h4 className="shrink-0 font-display text-2xl leading-none tracking-wide text-title">
          Exit this stage
        </h4>
        <span
          aria-hidden
          className="h-px flex-1 self-center"
          style={{ background: `linear-gradient(to right, ${gold(60)} 0%, ${gold(0)} 100%)` }}
        />
        <p className="shrink-0 font-numeral text-2xl leading-none tabular-nums text-command-gold">
          {ord}
          <span className="mx-1 text-muted">/</span>
          <span className="text-muted">{of}</span>
        </p>
      </div>
      <p className={`mt-3 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Next · <span className="text-command-gold">{next}</span>
      </p>
    </section>
  );
}

// H4d — a bracket that closes. The rule above fades right, the rule below fades
// LEFT: the pair reads as a closing parenthesis around the last thing the stage
// says. Mirroring is what makes it read as "closed" rather than "another rule".
export function H4d({ body, next }: ExitProps) {
  return (
    <section className="mt-10">
      <div
        aria-hidden
        className="h-px w-full"
        style={{ background: `linear-gradient(to right, ${gold(70)} 0%, ${gold(0)} 85%)` }}
      />
      <h4 className="mt-3 font-display text-2xl leading-none tracking-wide text-title">
        Exit this stage
      </h4>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
        Next · {next}
      </p>
      <div
        aria-hidden
        className="mt-3 h-px w-full"
        style={{ background: `linear-gradient(to left, ${gold(70)} 0%, ${gold(0)} 85%)` }}
      />
    </section>
  );
}

// H4e — the wash sits UNDER the sign-off and dies downward, so the card's last
// inches darken back into the field. Vertical rather than horizontal, which is
// the one direction `.section-band` does not already use, and it maps to what is
// actually happening: the page is ending.
export function H4e({ body, ord, of, next }: ExitProps) {
  return (
    <section
      className="-mx-4 mt-10 px-4 pb-6 pt-4"
      style={{
        background: `linear-gradient(to bottom, ${gold(7)} 0%, ${gold(2)} 45%, ${gold(0)} 100%)`,
        borderTop: `1px solid ${gold(45)}`,
      }}
    >
      <div className="flex items-baseline gap-3">
        <h4 className="shrink-0 font-display text-2xl leading-none tracking-wide text-title">
          Exit this stage
        </h4>
        <p className="ml-auto shrink-0 font-numeral text-2xl leading-none tabular-nums text-command-gold">
          {ord}
          <span className="mx-1 text-muted">/</span>
          <span className="text-muted">{of}</span>
        </p>
      </div>
      <p className={`mt-2 ${BODY}`}><T text={body} /></p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-command-gold">
        Next · {next}
      </p>
    </section>
  );
}
