import { describe, it, expect } from "vitest";
import {
  parseLastUser,
  parseLastProvider,
  providerLabel,
  initialsFrom,
} from "./last-auth";

describe("parseLastUser", () => {
  it("accepts a well-formed record and keeps optional fields", () => {
    expect(
      parseLastUser('{"email":"a@b.com","name":"Josh T","image":"x"}'),
    ).toEqual({ email: "a@b.com", name: "Josh T", image: "x" });
  });

  it("requires an @-email; drops non-string optionals", () => {
    expect(parseLastUser('{"email":"a@b.com","name":5}')).toEqual({
      email: "a@b.com",
      name: undefined,
      image: undefined,
    });
  });

  it("rejects garbage / missing email / null", () => {
    expect(parseLastUser(null)).toBeNull();
    expect(parseLastUser("not json")).toBeNull();
    expect(parseLastUser("{}")).toBeNull();
    expect(parseLastUser('{"email":"nope"}')).toBeNull();
  });
});

describe("parseLastProvider", () => {
  it("passes the three known providers, rejects anything else", () => {
    expect(parseLastProvider("google")).toBe("google");
    expect(parseLastProvider("github")).toBe("github");
    expect(parseLastProvider("resend")).toBe("resend");
    expect(parseLastProvider("facebook")).toBeNull();
    expect(parseLastProvider(null)).toBeNull();
  });
});

describe("providerLabel", () => {
  it("maps to display labels", () => {
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("github")).toBe("GitHub");
    expect(providerLabel("resend")).toBe("email");
  });
});

describe("initialsFrom", () => {
  it("uses the name's two words when present", () => {
    expect(initialsFrom({ email: "x@y.com", name: "Josh Tollette" })).toBe("JT");
  });
  it("falls back to the email local part", () => {
    expect(initialsFrom({ email: "josh.tollette@y.com" })).toBe("JT");
    expect(initialsFrom({ email: "solo@y.com" })).toBe("S");
  });
});
