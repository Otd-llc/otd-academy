// Lifecycle-email builders. Pure functions (unit-testable) → {subject, html, text}.
// COPY IS VERBATIM from docs/sales/lifecycle-emails.md (docs/academy-sales-kit
// branch) — do not paraphrase the subjects or bodies; they are founder-authored
// sales copy. Personalization tokens map to real data / env-configured links and
// are substituted by the caller (the lifecycle cron) before render.
//
// Shares the dark-theme wrapper from auth-magic-link-email.ts / sourcing-digest-
// email.ts (academy tokens from globals.css, table layout + inline styles, a
// bulletproof <table> button, a real text/plain alternative). Every footer carries
// the signed one-click unsubscribe link (CAN-SPAM / GDPR).

const DEEP_SPACE = "#08090d";
const NAVY_DARK = "#1f2438";
const COMMAND_GOLD = "#c8963e";
const GRAY_1 = "#e8e8e8";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/** Escape the five HTML-significant characters for safe embedding in markup/attributes. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface LifecycleEmail {
  subject: string;
  html: string;
  text: string;
}

interface WrapArgs {
  subject: string;
  /** Body paragraphs, in order. Each becomes a <p>; plain text, escaped here. */
  paragraphs: string[];
  /** The single CTA: visible label + destination URL. */
  cta: { label: string; url: string };
  /** Sign-off line (the founder's first name). */
  signOff: string;
  /** Absolute, signed one-click unsubscribe URL for this recipient. */
  unsubscribeUrl: string;
  /** Public host shown in the footer (e.g. academy.onethousanddrones.com). */
  host: string;
}

// Build the branded HTML + a text/plain alternative around the supplied copy.
function wrap({
  subject,
  paragraphs,
  cta,
  signOff,
  unsubscribeUrl,
  host,
}: WrapArgs): LifecycleEmail {
  const safeUnsub = esc(unsubscribeUrl);
  const safeCtaUrl = esc(cta.url);

  const paraHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">${esc(
          p,
        )}</p>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark only" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${esc(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${DEEP_SPACE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${DEEP_SPACE};">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:${NAVY_DARK};border:1px solid rgba(200,150,62,0.18);border-radius:10px;overflow:hidden;">
            <tr>
              <td style="height:2px;line-height:2px;font-size:0;background-color:${COMMAND_GOLD};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:34px 34px 36px;font-family:${SANS};">
                <div style="font-size:17px;font-weight:700;letter-spacing:0.3px;color:${GRAY_1};">
                  OTD <span style="color:${COMMAND_GOLD};">Academy</span>
                </div>

                ${paraHtml}

                <div style="margin:28px 0 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                    <tr>
                      <td bgcolor="${COMMAND_GOLD}" style="border-radius:6px;">
                        <a href="${safeCtaUrl}" target="_blank"
                           style="display:inline-block;padding:12px 30px;font-family:${SANS};font-size:14px;font-weight:700;color:${DEEP_SPACE};text-decoration:none;border-radius:6px;">
                          ${esc(cta.label)} &#8594;
                        </a>
                      </td>
                    </tr>
                  </table>
                </div>

                <p style="margin:30px 0 0;font-size:15px;line-height:1.6;color:#c5cad6;">${esc(
                  signOff,
                )}</p>

                <div style="height:1px;background-color:rgba(232,232,232,0.08);margin:28px 0 0;"></div>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.55;color:#6f7585;">
                  You're receiving this because you have an account at OTD Academy.
                  <a href="${safeUnsub}" target="_blank" style="color:#9aa0ae;text-decoration:underline;">Unsubscribe</a>
                  from these emails.
                </p>
              </td>
            </tr>
          </table>

          <div style="max-width:480px;margin:16px auto 0;font-family:${SANS};font-size:11px;color:#5a6070;text-align:center;">
            One Thousand Drones Academy &middot; ${esc(host)}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    ...paragraphs,
    "",
    `${cta.label}: ${cta.url}`,
    "",
    signOff,
    "",
    "You're receiving this because you have an account at OTD Academy.",
    `Unsubscribe: ${unsubscribeUrl}`,
    `One Thousand Drones Academy · ${host}`,
  ].join("\n");

  return { subject, html, text };
}

// ─── Personalization context ────────────────────────────────────────────────
// Real data / env-configured links the cron resolves per recipient before render.
export interface LifecycleContext {
  firstName: string; // [FIRST_NAME]
  founderFirstName: string; // [FOUNDER_FIRST_NAME]
  unsubscribeUrl: string; // signed one-click opt-out
  host: string; // footer host
  l101Url: string; // [L101_URL]
  certUrl?: string; // [CERT_URL]
  l2Url?: string; // [L2_URL]
  passUrl?: string; // [PASS_URL]
  upgradeUrl?: string; // [UPGRADE_URL]
  projectName?: string; // [PROJECT_NAME]
  projectPrice?: string; // [PROJECT_PRICE]
}

function base(ctx: LifecycleContext) {
  return {
    signOff: ctx.founderFirstName,
    unsubscribeUrl: ctx.unsubscribeUrl,
    host: ctx.host,
  };
}

// ─── Sequence 1: Welcome / onboarding ───────────────────────────────────────

/** 1.1 — opted in, account created, has not started L1.01. */
export function welcomeEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "Your first board starts now",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "You are in. Here is the short version of what you are about to do: design a real ESP32-S3 board, end to end, in KiCad 10. Requirements, BOM, schematic, ERC, layout, DRC, gerbers. The same files a fab house needs to make it.",
      "L1.01 is free and it is the right place to start. You do not need prior PCB experience. You need the software open and a little focus to reach your first clean check.",
      "When you finish, you walk away with fab-ready gerbers and a verifiable certificate.",
    ],
    cta: { label: "Start L1.01", url: ctx.l101Url },
  });
}

// ─── Sequence 2: Build-along nudges ─────────────────────────────────────────

/** 2.1 — started L1.01, no schematic saved after N days. */
export function schematicNudgeEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "Stuck on the schematic? Read this first",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "Most people slow down at the schematic, and it is usually the same handful of things: a part that will not connect, a net that looks right but is not, or ERC flagging something that reads like a foreign language.",
      "That is normal. ERC is doing its job. Work one error at a time, from the top of the list, and the schematic clears faster than you expect.",
      "The BOM is already priced against live DigiKey inside the lesson, so you can see real parts and real cost as you place them.",
    ],
    cta: { label: "Pick up where you left off", url: ctx.l101Url },
  });
}

/** 2.2 — schematic passes ERC, no layout progress after N days. */
export function layoutNudgeEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "You cleared ERC. Layout is next.",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "You got the schematic past ERC, which is the part most people find hardest. Layout is more visual and, for a lot of learners, more fun. You place the parts, route the connections, and run DRC.",
      "Here is the bar to keep in front of you: the lesson gates on a clean DRC and valid gerbers. That is the finish line. A clean DRC means the board can actually be made, not just drawn.",
      "Take it one rule violation at a time, same as ERC.",
    ],
    cta: { label: "Continue your layout", url: ctx.l101Url },
  });
}

/** 2.3 — layout started, DRC not clean after N days. */
export function drcNudgeEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "One clean DRC away",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "You are close. DRC errors feel discouraging in a block, but each one is a small, fixable thing: a clearance, a width, an unrouted connection. Clear them top to bottom and the count drops.",
      "When DRC reads zero errors and your gerbers export, you are done. The board is real and the files are ready to send to a fab house. You can order a kit if you want the parts on your bench, priced at the DigiKey BOM plus a small build margin.",
    ],
    cta: { label: "Finish your first board", url: ctx.l101Url },
  });
}

// ─── Sequence 3: Activation to upsell ───────────────────────────────────────

/** 3.1 — exported valid gerbers for L1.01 (or completed full L1 track). */
export function activationUpsellEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "You just designed a real board",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "Clean DRC. Valid gerbers. That is a real board you could send to a fab house today, and your certificate is live at academy.onethousanddrones.com/verify so anyone can confirm it.",
      `${ctx.certUrl ?? ""}`,
      "So, what is next. L2 is where the boards get more capable and the design choices get more interesting. The L2 battery module (L2.01) is free too, so start there. After that, paid boards are $49, one time, yours for life, no subscription. From there the path runs through L3 and into the two capstones: an 8-channel EEG brain-computer-interface front-end, and an ESP-NOW fleet hub.",
      "If you keep going, anything you pay for a single project credits toward the All-Access Pass later, so a-la-carte is never a dead end.",
    ].filter((p) => p.trim() !== ""),
    cta: { label: "Start L2", url: ctx.l2Url ?? ctx.l101Url },
  });
}

// ─── Sequence 4: Post-purchase pay-the-difference ───────────────────────────

/** 4.1 — completed first paid project purchase (any L2/L3/capstone/bench). */
export function payTheDifferenceEmail(ctx: LifecycleContext): LifecycleEmail {
  const projectName = ctx.projectName ?? "your project";
  const projectPrice = ctx.projectPrice ?? "what you paid";
  return wrap({
    ...base(ctx),
    subject: "Put what you paid toward everything",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      `Thanks for buying ${projectName}. Quick thing worth knowing before you go further.`,
      `What you paid for ${projectName} credits toward the All-Access Pass. The Pass opens all 22 boards (including the bench-tool projects and both capstones) across 4 tracks and 3 levels, one time, for life. If you expect to build more than a couple of these, the Pass is the cheaper path, and your ${projectPrice} is already part of it.`,
      "You only pay the difference. No need to repurchase anything you own.",
    ],
    cta: { label: "See your upgrade price", url: ctx.upgradeUrl ?? ctx.passUrl ?? ctx.l101Url },
  });
}

// ─── Sequence 5: Launch-window (Pass at $299) ───────────────────────────────

/** 5.1 — launch day, full L1 track (L1.01 to L1.05) live. */
export function launchDayEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "The full L1 track is live, and the Pass is $299 for 14 days",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "L1.01 through L1.05 are all live now. Five free boards, each one designed end to end, each one ending in clean DRC and valid gerbers with a verifiable cert.",
      "To mark it, the All-Access Pass is $299 for the next 14 days. After that it returns to $399 and stays there. The Pass is all 22 boards (including the bench-tool projects and both capstones), one time, for life, no subscription.",
      "If you have already paid for a project, that amount credits toward the Pass, so you pay less than $299.",
    ],
    cta: { label: "Get the Pass at $299", url: ctx.passUrl ?? ctx.l101Url },
  });
}

/** 5.2 — day 6 of window, has not bought the Pass. */
export function launchMidEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "What the $299 Pass actually covers",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "A reminder of what is inside the All-Access Pass while it is $299: all 22 boards, including the bench-tool projects and both capstones. The capstones are the reason a lot of people get the Pass: an 8-channel EEG brain-computer-interface front-end, and an ESP-NOW fleet hub. Real, fabricable boards at the harder end of the catalog.",
      "One payment. Lifetime access. The price moves to $399 when the window closes.",
    ],
    cta: { label: "Get the Pass at $299", url: ctx.passUrl ?? ctx.l101Url },
  });
}

/** 5.3 — 48 hours before window closes, has not bought the Pass. */
export function launch48hEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "48 hours left at $299",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "The $299 window on the All-Access Pass closes in 48 hours. After that it is $399.",
      "This is the only discount on the Pass. Individual projects are never discounted, so this window is the cheapest the full catalog will be. If you have paid for any project already, that credits toward the price.",
      "Everything, for life, one payment.",
    ],
    cta: { label: "Get the Pass at $299", url: ctx.passUrl ?? ctx.l101Url },
  });
}

/** 5.4 — final hours before window closes, has not bought the Pass. */
export function launchLastCallEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "Last call: $299 ends today",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "The launch price ends today. After tonight the All-Access Pass is $399 and stays there.",
      "If you have been weighing it, this is the moment. All 22 boards (including the bench-tool projects and both capstones), one payment, for life. Any project you have already paid for credits toward the total.",
    ],
    cta: { label: "Get the Pass at $299 before it closes", url: ctx.passUrl ?? ctx.l101Url },
  });
}

// ─── Sequence 6: Win-back for stalled L1 ────────────────────────────────────

/** 6.1 — started L1.01, no progress for N days, no purchase. */
export function winBackEmail(ctx: LifecycleContext): LifecycleEmail {
  return wrap({
    ...base(ctx),
    subject: "Your board is right where you left it",
    paragraphs: [
      `Hi ${ctx.firstName},`,
      "You started L1.01 and then life happened. Your work is saved exactly where you left it, so there is no restart and no penalty for the gap.",
      "If you forgot where you were: the goal is a clean DRC and valid gerbers. If you stop early, that is the one thing to come back and finish, because that is the moment you have a real board and a certificate.",
      "It is free. Twenty minutes might be all that is between you and done.",
    ],
    cta: { label: "Pick up your board", url: ctx.l101Url },
  });
}

// ─── Sequence registry ──────────────────────────────────────────────────────
// Maps each LifecycleSend.sequence id to its builder. Keys are the email ids from
// the docs file; the cron uses these to pick the builder for a selected audience.
export const LIFECYCLE_BUILDERS = {
  "1.1": welcomeEmail,
  "2.1": schematicNudgeEmail,
  "2.2": layoutNudgeEmail,
  "2.3": drcNudgeEmail,
  "3.1": activationUpsellEmail,
  "4.1": payTheDifferenceEmail,
  "5.1": launchDayEmail,
  "5.2": launchMidEmail,
  "5.3": launch48hEmail,
  "5.4": launchLastCallEmail,
  "6.1": winBackEmail,
} as const satisfies Record<string, (ctx: LifecycleContext) => LifecycleEmail>;

export type LifecycleSequence = keyof typeof LIFECYCLE_BUILDERS;
