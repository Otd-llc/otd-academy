// GA4 under Google Consent Mode "basic": gtag.js must never be requested before
// a measurement grant, events before the grant must wait (not vanish, not leak),
// and the dataLayer must receive ARGUMENTS objects, the one shape gtag.js reads.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { envMock, consent } = vi.hoisted(() => ({
  envMock: { NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-TEST123" as string | undefined },
  consent: { granted: false },
}));
vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/consent-signal", () => ({
  analyticsConsentGranted: () => consent.granted,
}));

import { gaEvent, gaPageView, loadGa, revokeGa, __resetGaForTests } from "@/lib/ga-client";

type Win = { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; location: { hostname: string } };
let win: Win;
let appended: { src: string; async: boolean }[];
let cookieWrites: string[];
let cookieJar: string;

beforeEach(() => {
  __resetGaForTests();
  envMock.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
  consent.granted = false;
  appended = [];
  cookieWrites = [];
  cookieJar = "";
  win = { location: { hostname: "academy.onethousanddrones.com" } };
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", {
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (el: { src: string; async: boolean }) => appended.push(el) },
    get cookie() {
      return cookieJar;
    },
    set cookie(v: string) {
      cookieWrites.push(v);
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

/** The dataLayer entries as plain arrays, for readable assertions. */
const calls = () => (win.dataLayer ?? []).map((a) => Array.from(a as ArrayLike<unknown>));

describe("ga-client", () => {
  it("requests NOTHING before consent", () => {
    expect(loadGa()).toBe(false);
    gaEvent("sign_up");
    expect(appended).toHaveLength(0);
    expect(win.dataLayer).toBeUndefined();
  });

  it("requests NOTHING when unconfigured, even with consent", () => {
    envMock.NEXT_PUBLIC_GA_MEASUREMENT_ID = undefined;
    consent.granted = true;
    expect(loadGa()).toBe(false);
    expect(appended).toHaveLength(0);
  });

  it("on grant: one gtag.js, ads signals denied, Google signals off", () => {
    consent.granted = true;
    expect(loadGa()).toBe(true);
    expect(loadGa()).toBe(true); // idempotent
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe("https://www.googletagmanager.com/gtag/js?id=G-TEST123");
    expect(appended[0].async).toBe(true);
    const [def, js, config] = calls();
    expect(def).toEqual([
      "consent",
      "default",
      { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" },
    ]);
    expect(js[0]).toBe("js");
    expect(config).toEqual([
      "config",
      "G-TEST123",
      { allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: false },
    ]);
  });

  it("pushes ARGUMENTS objects, not arrays (gtag.js ignores arrays)", () => {
    consent.granted = true;
    loadGa();
    const first = win.dataLayer![0];
    expect(Array.isArray(first)).toBe(false);
    expect(Object.prototype.toString.call(first)).toBe("[object Arguments]");
  });

  it("holds pre-consent events and flushes them on grant, in order", () => {
    gaEvent("generate_lead", { lead_source: "waitlist" });
    gaEvent("sign_up");
    expect(win.dataLayer).toBeUndefined();
    consent.granted = true;
    loadGa();
    const events = calls().filter((c) => c[0] === "event");
    expect(events).toEqual([
      ["event", "generate_lead", { lead_source: "waitlist" }],
      ["event", "sign_up", undefined],
    ]);
  });

  it("a revoke drops held events, so a later grant sends none of them", () => {
    gaEvent("sign_up");
    revokeGa();
    consent.granted = true;
    loadGa();
    expect(calls().filter((c) => c[0] === "event")).toEqual([]);
  });

  it("a page view SETS the scrubbed page first, so every later hit inherits it", () => {
    gaPageView({ location: "https://a.example/learn/x/certificate/[token]", title: "Certificate", referrer: "https://a.example/learn" });
    // queued pre-consent as whole commands, in order
    expect(win.dataLayer).toBeUndefined();
    consent.granted = true;
    loadGa();
    const tail = calls().slice(-2);
    expect(tail).toEqual([
      ["set", { page_location: "https://a.example/learn/x/certificate/[token]", page_title: "Certificate", page_referrer: "https://a.example/learn" }],
      ["event", "page_view", undefined],
    ]);
  });

  it("a first page view with no referrer sets an empty one, not the document's", () => {
    consent.granted = true;
    gaPageView({ location: "https://a.example/", title: "Home" });
    expect(calls().at(-2)).toEqual(["set", { page_location: "https://a.example/", page_title: "Home", page_referrer: "" }]);
  });

  it("a re-grant in the same page lifts the opt-out switch", () => {
    consent.granted = true;
    loadGa();
    revokeGa();
    loadGa();
    expect((win as Record<string, unknown>)["ga-disable-G-TEST123"]).toBe(false);
    expect(calls().at(-1)).toEqual(["consent", "update", { analytics_storage: "granted" }]);
  });

  it("a revoke after boot denies analytics_storage and deletes _ga cookies on every domain", () => {
    consent.granted = true;
    loadGa();
    cookieJar = "theme=dark; _ga=GA1.1.42; _ga_TEST123=GS2.1.s1";
    consent.granted = false;
    revokeGa();
    expect(calls().at(-1)).toEqual(["consent", "update", { analytics_storage: "denied" }]);
    expect((win as Record<string, unknown>)["ga-disable-G-TEST123"]).toBe(true);
    for (const name of ["_ga", "_ga_TEST123"]) {
      expect(cookieWrites).toContain(`${name}=; Max-Age=0; path=/`);
      expect(cookieWrites).toContain(`${name}=; Max-Age=0; path=/; domain=.onethousanddrones.com`);
      expect(cookieWrites).toContain(
        `${name}=; Max-Age=0; path=/; domain=.academy.onethousanddrones.com`,
      );
    }
    expect(cookieWrites.some((w) => w.includes("domain=.com"))).toBe(false);
    expect(cookieWrites.some((w) => w.startsWith("theme="))).toBe(false);
  });
});

describe("ga-client consent updates", () => {
  it("events after boot do NOT each re-send a consent update", () => {
    consent.granted = true;
    loadGa();
    gaEvent("scroll");
    gaEvent("sign_up");
    expect(calls().filter((c) => c[0] === "consent" && c[1] === "update")).toEqual([]);
  });
});
