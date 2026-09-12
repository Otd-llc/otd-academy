"use client";

// Client boundary around the c15t consent stack. The root layout is a server
// component, and `@c15t/nextjs`'s ConsentManagerProvider (React context) must be
// evaluated client-side — importing it directly into the server layout ran its
// createContext during build page-data collection ("createContext is not a
// function"). Re-exporting the whole stack from one "use client" module gives
// the RSC a single client child to render.
//
// Offline mode: consent state lives in localStorage, no backend. `measurement`
// (analytics) is opt-in by default, so PostHog stays dark until consent — the
// ConsentBridge mirrors that decision into getPosthog()'s gate.
import { ConsentManagerProvider, ConsentBanner } from "@c15t/nextjs";
// The banner's stylesheet. Without it the ConsentBanner renders UNSTYLED: raw
// text in document flow and the "Secured by c15t" logo SVG explodes to its
// natural size at the page bottom (shipped that way in #344; fixed here).
import "@c15t/nextjs/styles.css";
import { ConsentBridge } from "@/components/chrome/ConsentBridge";

// The categories this site actually uses, declared explicitly.
//
// THIS IS LOAD BEARING, and its absence was a silent, total failure. c15t only
// grants categories it has been told are ACTIVE, so with none declared,
// "Accept All" stored:
//
//   {"necessary":true,"functionality":false,"measurement":false,
//    "experience":false,"marketing":false}
//
// measurement stayed FALSE. PostHog is gated on measurement, so it never
// initialised: no cookie, no events, no distinct id, for anyone, ever. The
// banner dismissed itself and the visitor reasonably believed they had
// accepted. Verified against production on 2026-08-03, and it explains why
// nobody noticed NEXT_PUBLIC_POSTHOG_KEY was unset — analytics could not have
// worked even with it.
//
// It failed CLOSED, which is the right direction for a consent bug to fail in,
// but the banner was telling people something untrue.
//
// Only `necessary` and `measurement` are listed because they are the only two
// this site has: PostHog is the sole non-essential thing, and asking for
// consent to categories we do not use would be its own kind of dishonest.
const CONSENT_CATEGORIES = ["necessary", "measurement"] as const;

// The banner, in the house console language instead of the vendor default.
//
// EVERY COLOUR IS ONE OF OUR CSS VARIABLES, NOT A HEX. c15t ships a `dark`
// token group beside `colors`, and using it would mean maintaining a second
// palette that flips on ITS trigger (a `.dark` class or prefers-color-scheme)
// rather than on ours (`[data-theme]`). Feeding it `var(--color-*)` instead
// means there is one palette, it is the site's, and the banner follows the
// theme toggle for free.
//
// `textOnPrimary` IS SET EXPLICITLY AND MUST STAY THAT WAY. c15t derives it
// from `primary` when omitted, and that derivation reads the colour to pick a
// readable foreground -- which it cannot do with the string "var(--color-
// command-gold)". Omitted, the accept button renders unreadable.
const CONSENT_THEME = {
  colors: {
    primary: "var(--color-command-gold)",
    primaryHover: "var(--color-gold-light)",
    // Floating chrome is deep-space + a gold hairline + elevation over a
    // dimmed backdrop, never a filled navy card (globals.css, 2026-07-09).
    surface: "var(--color-deep-space)",
    surfaceHover: "color-mix(in srgb, var(--color-command-gold) 6%, transparent)",
    border: "color-mix(in srgb, var(--color-command-gold) 25%, transparent)",
    borderHover: "var(--color-command-gold)",
    text: "var(--color-title)",
    textMuted: "var(--color-muted)",
    textOnPrimary: "var(--color-deep-space)",
    overlay: "color-mix(in srgb, var(--color-deep-space) 72%, transparent)",
    switchTrack: "var(--color-panel-border)",
    switchTrackActive: "var(--color-command-gold)",
    switchThumb: "var(--color-deep-space)",
  },
  typography: {
    // Lora is the reading voice; the title and the buttons take their own
    // faces through slots below.
    fontFamily: "var(--font-serif)",
  },
  // The restrained corner language: 6px for chrome, 8px for the panel. `full`
  // exists only because the consent toggle is a switch and a switch is round;
  // nothing else here may use it, and no button does.
  radius: { sm: "4px", md: "6px", lg: "8px", full: "9999px" },
  shadows: {
    sm: "var(--elev-raise)",
    md: "var(--elev-raise)",
    lg: "var(--elev-card)",
  },
  slots: {
    consentBannerCard:
      "border border-command-gold/25 bg-deep-space [box-shadow:var(--elev-card)]",
    consentBannerTitle:
      "font-display text-2xl tracking-[0.04em] text-title",
    consentBannerDescription:
      "font-serif text-sm leading-relaxed text-muted",
    consentBannerFooter: "border-t border-panel-border/60",
    // Accept carries the gold fill (owner decision, see `consentActions`), but
    // Reject keeps the same face, size, tracking, radius and row position. Only
    // the fill differs.
    // THE LIGHT-THEME FILL IS DEEPER, AND THAT IS A CONTRAST FIX, NOT A TASTE
    // ONE. Filled, this button paints `textOnPrimary` on `primary`. In dark
    // that is near-black ink on #c8963e = 7.48:1, fine. In light it is cream on
    // #9c7016 = 4.14:1, UNDER the WCAG AA 4.5 floor -- and mid-gold is awkward
    // enough that flipping to dark ink instead only reaches 4.00:1. Neither
    // foreground rescues that fill.
    //
    // So the fill deepens on light to --color-gold-light (#7e5610), which is
    // the token's own emphasis value on ivory (the ramp INVERTS on light: gold
    // emphasis goes deeper, not brighter). Cream on that measures 6.5:1.
    // Verified by measurement, not arithmetic on paper.
    buttonPrimary:
      "font-mono text-[11px] uppercase tracking-[0.16em] rounded-[6px] [[data-theme='light']_&]:bg-gold-light",
    // THE BORDER IS DELIBERATELY STRONGER THAN THE PANEL'S. Measured, this
    // button's edge was 1.47:1 against the card in dark and 1.35:1 in light --
    // it inherited `colors.border`, which is a panel hairline and too faint to
    // read as a control edge.
    //
    // Full gold, not a fraction of it: at 70% the edge measured 4.07:1 on the
    // dark field but only 2.53:1 on ivory, because the light gold sits closer
    // to its own background. Full strength clears the floor in both (7.48 dark,
    // 4.14 light).
    //
    // 3:1 IS NOT A NUMBER WE PICKED. It is the floor the Austrian DSB named in
    // the ORF.at order as an explicit alternative to colouring every button
    // identically ("either the same colour for all buttons, or colours meeting
    // the ISO 9241-303 contrast recommendation"). It is also the WCAG 2.2
    // non-text contrast threshold for UI component boundaries, so the same
    // change answers the accessibility question and the consent-design one.
    // Verified by measurement in both themes; see the commit message.
    buttonSecondary:
      "font-mono text-[11px] uppercase tracking-[0.16em] rounded-[6px] border-command-gold",
    // The vendor tag is a blue pill by default, the single most off-brand
    // thing on the page. Kept rather than hidden (`hideBranding` on
    // <ConsentBanner /> would remove it) and restyled to a small gold chip.
    //
    // TYPOGRAPHY ONLY, NO COLOUR. c15t treats the branding tag as a
    // PRIMARY-FILLED surface: it fills with `colors.primary` and colours its
    // inner text with `colors.textOnPrimary`. Overriding just the tag's
    // background to deep-space left those inner spans still painting
    // textOnPrimary, which is also deep-space -- dark on dark, invisible.
    // Taking the fill it is designed for gives gold-on-deep-space for free,
    // and it flips with the theme like everything else here.
    consentBannerTag: "font-mono text-[10px] uppercase tracking-[0.18em]",
  },
  // OWNER DECISION (2026-08-18): Accept All takes the gold, not Customize.
  //
  // The stock policy pack hints `customize` as the primary action, which is why
  // it was the only gold control on the panel while the two actual decisions
  // either side of it were plain. The emphasis moves to `accept`, and Customize
  // drops to a ghost so exactly one control is filled rather than two competing.
  //
  // WHAT WAS CHECKED FIRST, recorded so nobody re-litigates it from memory:
  // GDPR Art 4(11)/7 and ePrivacy Art 5(3) contain no button-styling provision;
  // the EDPB Cookie Banner Taskforce report §17 EXPRESSLY declined to impose a
  // colour/contrast standard, and the only practice §18 calls manifestly
  // unlawful is a reject button whose text is "unreadable to virtually any
  // user" (ours measures 16.9:1). No EU authority has fined on prominence
  // alone. The two adverse rulings that exist -- Austrian DSB/BVwG (ORF.at,
  // non-final) and Belgian VRT (settlement, fine expressly refused) -- both
  // involved a reject control that dissolved into the banner: the ORF one
  // measured 1.13:1.
  //
  // The live objections, stated rather than buried: CNIL recommends both
  // buttons be "mis en evidence de maniere identique", and EDPB Guidelines
  // 03/2022 say that where one option IS highlighted it should be the most
  // privacy-protective. Neither is binding law; CNIL calls its own
  // recommendation "sans toutefois etre prescriptive" and 03/2022 is scoped to
  // social media platforms. With no EU establishment there is no one-stop-shop,
  // so the strictest national reading is the one that would apply.
  //
  // To restore equal weight later, this is a two-line revert: drop the `accept`
  // entry below and remove `primaryButton` from <ConsentBanner />.
  consentActions: {
    default: { mode: "stroke" },
    accept: { variant: "primary", mode: "filled" },
    customize: { variant: "neutral", mode: "ghost" },
  },
} as const;

export function ConsentProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: [...CONSENT_CATEGORIES],
        theme: CONSENT_THEME,
      }}
    >
      <ConsentBridge />
      {/* The primary-action hint, moved off `customize` and onto `accept`.
          Without it the policy pack keeps pointing at Customize and the fill
          above lands on a control the pack does not treat as primary. */}
      <ConsentBanner primaryButton="accept" />
      {children}
    </ConsentManagerProvider>
  );
}
