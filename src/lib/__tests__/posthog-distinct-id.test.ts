// Reading the browser's PostHog person id server-side.
//
// The failure that matters is not "no id" — that is safe, the caller falls back
// to an anonymous event. It is a WRONG id, which attributes a real action to
// the wrong person and silently corrupts the funnel it exists to measure. So
// most of these assert that garbage yields null rather than something.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseDistinctId,
  posthogCookieName,
} from "@/lib/posthog-distinct-id";

const ID = "01920f3a-4c7b-7000-8f2a-9b1d3e5c7a11";

function cookie(obj: unknown, encode = true): string {
  const json = JSON.stringify(obj);
  return encode ? encodeURIComponent(json) : json;
}

describe("posthogCookieName", () => {
  it("matches what posthog-js writes", () => {
    expect(posthogCookieName("phc_abc123")).toBe("ph_phc_abc123_posthog");
  });
});

describe("parseDistinctId — what it reads", () => {
  it("reads a URL-encoded cookie", () => {
    expect(parseDistinctId(cookie({ distinct_id: ID }))).toBe(ID);
  });

  it("reads an un-encoded cookie", () => {
    expect(parseDistinctId(cookie({ distinct_id: ID }, false))).toBe(ID);
  });

  it("ignores the other fields posthog-js stores alongside it", () => {
    const value = cookie({
      distinct_id: ID,
      $sesid: [1754179200000, "0192-sess", 1754179200000],
      $device_id: "0192-dev",
      $initial_referrer: "https://www.printables.com/",
    });
    expect(parseDistinctId(value)).toBe(ID);
  });

  it("reads an identified (email-shaped) id, not just a uuid", () => {
    // After sign-in, identify() replaces the anonymous id with the user id.
    expect(parseDistinctId(cookie({ distinct_id: "usr_abc123" }))).toBe("usr_abc123");
  });
});

describe("parseDistinctId — what it refuses", () => {
  it.each([
    [undefined, "no cookie at all"],
    ["", "an empty cookie"],
    ["not json", "a non-JSON value"],
    ["%E0%A4%A", "malformed percent-encoding"],
    [cookie({}), "JSON with no distinct_id"],
    [cookie({ distinct_id: "" }), "an empty distinct_id"],
    [cookie({ distinct_id: 42 }), "a non-string distinct_id"],
    [cookie({ distinct_id: null }), "a null distinct_id"],
    [cookie([ID]), "a JSON array"],
    ["null", "the JSON literal null"],
    ['"' + ID + '"', "a bare JSON string"],
  ])("returns null for %s (%s)", (value: string | undefined, _why: string) => {
    expect(parseDistinctId(value)).toBeNull();
  });
});

describe("distinctIdFromCookies", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load() {
    vi.resetModules();
    return import("@/lib/posthog-distinct-id");
  }

  it("returns null when analytics is disabled, without reading a cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", undefined);
    const { distinctIdFromCookies } = await load();
    const get = vi.fn();
    expect(distinctIdFromCookies({ get })).toBeNull();
    // No key means no cookie name to look for; do not even ask.
    expect(get).not.toHaveBeenCalled();
  });

  it("reads the project-specific cookie when analytics is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { distinctIdFromCookies } = await load();
    const get = vi.fn().mockReturnValue({ value: cookie({ distinct_id: ID }) });
    expect(distinctIdFromCookies({ get })).toBe(ID);
    expect(get).toHaveBeenCalledWith("ph_phc_test_posthog");
  });

  it("returns null when the visitor has no PostHog cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    const { distinctIdFromCookies } = await load();
    expect(distinctIdFromCookies({ get: () => undefined })).toBeNull();
  });
});
