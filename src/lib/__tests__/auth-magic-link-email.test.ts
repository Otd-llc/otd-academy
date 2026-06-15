import { describe, it, expect } from "vitest";
import { magicLinkEmail } from "@/lib/auth-magic-link-email";

describe("magicLinkEmail", () => {
  const url =
    "https://academy.onethousanddrones.com/api/auth/callback/resend?token=abc&email=raven%40example.com";
  const host = "academy.onethousanddrones.com";

  it("returns a subject, html, and text", () => {
    const mail = magicLinkEmail({ url, host });
    expect(mail.subject).toMatch(/sign in/i);
    expect(mail.html).toContain("<html");
    expect(mail.text.length).toBeGreaterThan(0);
  });

  it("puts the sign-in url in the button href and the plain-text body", () => {
    const mail = magicLinkEmail({ url, host });
    // In HTML the ampersand is escaped to &amp; (correct per spec; the browser
    // decodes it back so the link still works). Plain text keeps the raw url.
    expect(mail.html).toContain(`href="${url.replace(/&/g, "&amp;")}"`);
    expect(mail.text).toContain(url);
  });

  it("carries the brand: wordmark, command-gold, deep-space", () => {
    const { html } = magicLinkEmail({ url, host });
    expect(html).toContain("Academy");
    expect(html).toContain("#c8963e"); // command-gold
    expect(html).toContain("#08090d"); // deep-space
  });

  it("states the link is single-use and expiring", () => {
    const { html, text } = magicLinkEmail({ url, host });
    expect(`${html} ${text}`.toLowerCase()).toMatch(/expire|once|24 hours/);
  });

  it("escapes HTML-special characters so a crafted url can't break out of the href", () => {
    const evil = "https://x.test/cb?token=a\"><script>alert(1)</script>";
    const { html } = magicLinkEmail({ url: evil, host });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
