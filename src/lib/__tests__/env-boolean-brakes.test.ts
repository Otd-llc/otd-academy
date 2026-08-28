// The env schema's boolean parsing, specifically the shapes that made a kill switch
// fail OPEN.
//
// `z.coerce.boolean()` is `Boolean(v)`, and every non-empty string is truthy — so
// `LIFECYCLE_EMAIL_ENABLED="false"` parsed to `true` and ENABLED the lifecycle cron.
// That is the documented emergency brake on marketing email to real users, and the
// one thing it had to do was stop sends when set to "false". Ledger row TD-001.
//
// These assert the PARSER, not the schema object, so they stay meaningful regardless
// of how env.ts is assembled and need no env bootstrapping to run.
import { describe, expect, test } from "vitest";
import { z } from "zod";

describe("string-to-boolean env parsing", () => {
  const brake = z.stringbool().default(true);

  test('"false" disables — the exact bug TD-001 recorded', () => {
    expect(brake.parse("false")).toBe(false);
    // The old parser's answer, kept as a live contrast so the regression is legible.
    expect(z.coerce.boolean().parse("false")).toBe(true);
  });

  test("every conventional falsy spelling disables", () => {
    for (const v of ["false", "0", "no", "off", "FALSE", "Off"]) {
      expect(brake.parse(v)).toBe(false);
    }
  });

  test("every conventional truthy spelling enables", () => {
    for (const v of ["true", "1", "yes", "on", "TRUE", "On"]) {
      expect(brake.parse(v)).toBe(true);
    }
  });

  test("unset still defaults to enabled, so the cron is opt-OUT not opt-in", () => {
    expect(brake.parse(undefined)).toBe(true);
  });

  test("a non-boolean string is rejected rather than silently coerced", () => {
    // The failure mode being closed is a typo reading as "on". Better to fail the
    // build than to quietly enable marketing email because someone wrote "flase".
    expect(() => brake.parse("flase")).toThrow();
  });
});
