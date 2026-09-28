// The published v1 LICENSE.txt must not move by a byte, and the v2 one must
// carry its year and the owner's approved disclaimer (launch item 6.8).
//
// The v1 pin is a sha256 of the text `scripts/upload-printables.ts` carried from
// its first commit (2bd48dc1) to the 2026-08-17 release, computed from that
// commit's blob rather than from the moved copy, so it is not a pin between a
// constant and itself. 836 B is also what was HEAD'd off the published object
// (`HEX_RELEASE_FILES.license`).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  HEX_CREDIT_MODIFICATIONS_SLOT,
  HEX_LICENSE,
} from "@/lib/hex-license";
import {
  HEX_LICENSE_DISCLAIMER,
  HEX_V1_LICENSE_RELEASES,
  HEX_V1_LICENSE_TXT,
  hexLicenseTxt,
  ownerWordingPending,
} from "@/lib/hex-license-txt";
import { HEX_RELEASE, HEX_RELEASE_FILES } from "@/lib/hex-spec";

const V1_SHA256 =
  "e7145e51e43da01f79edae2b5e8d6be4939971f81fb9442df9a33e43e0f3f24b";
const V1_BYTES = 836;

// The owner's approved words (2026-09-28), typed here independently of the
// module so a silent rewording of the constant fails this file.
const APPROVED_DISCLAIMER =
  "These files are provided as is, without warranty of any kind, including fitness for a particular purpose. You print, assemble and use them at your own risk. One Thousand Drones LLC is not liable for damage or injury arising from their use. Section 5 of the CC BY 4.0 licence also applies.";
const APPROVED_MODIFICATIONS =
  "If you changed the files, say so, and say what you changed.";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const ASCII_ONLY = /^[\x00-\x7f]*$/;

describe("v1 LICENSE.txt: the published releases stay byte-for-byte", () => {
  it("names exactly the three published releases, and the current release is not one", () => {
    expect([...HEX_V1_LICENSE_RELEASES]).toEqual([
      "2026-07-31",
      "2026-08-03",
      "2026-08-17",
    ]);
    // The uploader defaults to HEX_RELEASE, which is now the generated v2
    // release (4.6). A plain run must mint the v2 notice for it, and must never
    // land on a published v1 key, whose bytes are frozen.
    expect(HEX_V1_LICENSE_RELEASES).not.toContain(HEX_RELEASE);
  });

  for (const release of HEX_V1_LICENSE_RELEASES) {
    it(`${release} rebuilds the published bytes`, () => {
      const txt = hexLicenseTxt(release);
      expect(sha(txt)).toBe(V1_SHA256);
      expect(Buffer.byteLength(txt, "utf8")).toBe(V1_BYTES);
      expect(Buffer.byteLength(txt, "utf8")).toBe(
        HEX_RELEASE_FILES.license.bytes,
      );
      expect(ownerWordingPending(txt)).toEqual([]);
    });
  }

  it("the frozen constant itself is the published text", () => {
    expect(sha(HEX_V1_LICENSE_TXT)).toBe(V1_SHA256);
  });
});

describe("v2 LICENSE.txt", () => {
  const txt = hexLicenseTxt("2026-10-01");

  it("stamps the release's year into the copyright line", () => {
    expect(txt).toContain(
      `Copyright (c) 2026 ${HEX_LICENSE.holder}`,
    );
    expect(hexLicenseTxt("2027-03-05")).toContain("Copyright (c) 2027 ");
  });

  it("carries the owner's approved disclaimer, word for word, and nothing pending", () => {
    expect(HEX_LICENSE_DISCLAIMER).toBe(APPROVED_DISCLAIMER);
    // Wrapped to the file's width: rejoining the lines gives the words back.
    expect(txt.split("\n").join(" ")).toContain(APPROVED_DISCLAIMER);
    for (const line of txt.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
    expect(ownerWordingPending(txt)).toEqual([]);
  });

  it("still reports a reintroduced placeholder as pending", () => {
    const marked = txt.replace(
      APPROVED_DISCLAIMER.split(" ").slice(0, 6).join(" "),
      "[OWNER-WORDING: reintroduced]",
    );
    expect(marked).not.toBe(txt);
    expect(ownerWordingPending(marked)).toEqual(["[OWNER-WORDING: reintroduced]"]);
  });

  it("differs from v1, still cites the licence and the source, and is ASCII", () => {
    expect(sha(txt)).not.toBe(V1_SHA256);
    expect(txt).toContain(HEX_LICENSE.deed);
    expect(txt).toContain(HEX_LICENSE.legalCode);
    expect(txt).toContain("Source: https://academy.onethousanddrones.com/hex");
    expect(ASCII_ONLY.test(txt)).toBe(true);
  });

  it("refuses a release that is not a date, rather than inventing a year", () => {
    for (const bad of ["TODO-v2-release", "latest", "", "2026-8-3"]) {
      expect(() => hexLicenseTxt(bad), bad).toThrow(/ISO date/);
    }
  });
});

describe("the uploader builds its LICENSE.txt from this module", () => {
  const src = readFileSync(
    join(process.cwd(), "scripts/upload-printables.ts"),
    "utf8",
  );

  it("calls hexLicenseTxt(RELEASE) and keeps no second copy of the text", () => {
    expect(src).toMatch(/const LICENSE_TXT = hexLicenseTxt\(RELEASE\);/);
    expect(src).not.toMatch(/Copyright \(c\)/);
  });

  // The refusal now scans EVERY file the run would upload for any
  // `[OWNER-WORDING:` marker (LICENSE.txt included), not this notice alone.
  // Behaviour is proved end to end in upload-printables.test.ts ("owner
  // wording"); this pins that the scan feeds a --write throw.
  it("refuses --write while an owner placeholder is still in the notice", () => {
    expect(src).toMatch(
      /const pending = scan\.flatMap\([\s\S]*?ownerWordingIn\(data\)[\s\S]*?if \(pending\.length\) \{\s*if \(write\) \{\s*throw/,
    );
  });
});

describe("the credit line (CC BY 4.0 s3(a)(1))", () => {
  it("carries the licence URI and the owner's modifications line, Source last", () => {
    expect(HEX_LICENSE.credit).toContain(
      "https://creativecommons.org/licenses/by/4.0/",
    );
    expect(HEX_LICENSE.credit).toContain(HEX_CREDIT_MODIFICATIONS_SLOT);
    expect(HEX_CREDIT_MODIFICATIONS_SLOT).toBe(APPROVED_MODIFICATIONS);
    expect(HEX_LICENSE.credit).not.toMatch(/OWNER-WORDING/);
    expect(HEX_LICENSE.credit).toMatch(
      /Source: https:\/\/academy\.onethousanddrones\.com\/hex$/,
    );
  });

  it("is ASCII and XML-safe, since it rides in 3MF metadata and README.txt", () => {
    expect(ASCII_ONLY.test(HEX_LICENSE.credit)).toBe(true);
    expect(HEX_LICENSE.credit).not.toMatch(/[<>&"]/);
  });
});
