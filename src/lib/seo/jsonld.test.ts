import { describe, expect, it } from "vitest";
import { techArticleJsonLd, learningResourceJsonLd, definedTermJsonLd, videoObjectJsonLd, organizationJsonLd, aboutPageJsonLd } from "@/lib/seo/jsonld";

describe("videoObjectJsonLd", () => {
  it("derives thumbnail, nocookie embed, and canonical watch url from the bare id", () => {
    const v = videoObjectJsonLd({
      name: "Wire the regulator",
      description: "Placing and wiring U2 (the 3.3 V LDO).",
      videoId: "dQw4w9WgXcQ",
      uploadDate: "2026-07-06",
    }) as Record<string, unknown>;
    expect(v["@type"]).toBe("VideoObject");
    expect(v.name).toBe("Wire the regulator");
    expect(v.description).toBe("Placing and wiring U2 (the 3.3 V LDO).");
    expect(v.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(v.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(v.contentUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(v.uploadDate).toBe("2026-07-06");
  });
  it("falls back to the name when no description, and omits uploadDate when absent", () => {
    const v = videoObjectJsonLd({
      name: "Course intro",
      description: null,
      videoId: "abc123",
    }) as Record<string, unknown>;
    expect(v.description).toBe("Course intro");
    expect("uploadDate" in v).toBe(false);
  });
});

describe("techArticleJsonLd", () => {
  it("emits an absolute url + headline and omits empty optionals", () => {
    const a = techArticleJsonLd({
      headline: "Motor Imagery & the Mu Rhythm",
      description: "How sensorimotor rhythms drive a BCI.",
      url: "https://academy.onethousanddrones.com/library/motor-imagery-bci",
      datePublished: "2026-06-21",
      dateModified: "2026-06-21",
      authorName: "One Thousand Drones",
    }) as Record<string, unknown>;
    expect(a["@type"]).toBe("TechArticle");
    expect(a.headline).toBe("Motor Imagery & the Mu Rhythm");
    expect(a.mainEntityOfPage).toBe("https://academy.onethousanddrones.com/library/motor-imagery-bci");
  });
  it("omits author when absent", () => {
    const a = techArticleJsonLd({ headline: "x", description: null, url: "https://e/x" }) as Record<string, unknown>;
    expect("author" in a).toBe(false);
    expect("description" in a).toBe(false);
  });
});

describe("learningResourceJsonLd", () => {
  it("emits a LearningResource with the name + url", () => {
    const r = learningResourceJsonLd({ name: "ADS1299 Explained", description: "d", url: "https://e/x", educationalLevel: "Beginner" }) as Record<string, unknown>;
    expect(r["@type"]).toBe("LearningResource");
    expect(r.educationalLevel).toBe("Beginner");
  });
});

describe("definedTermJsonLd", () => {
  it("emits a DefinedTerm with the term set + canonical url", () => {
    const d = definedTermJsonLd({
      name: "Embodied Motor Imagery",
      alternateName: "EMI",
      description: "OTD's overtrained-procedural-motor-program approach to BCI control.",
      url: "https://academy.onethousanddrones.com/library/motor-imagery-bci",
      termSetName: "One Thousand Drones BCI Glossary",
      termSetUrl: "https://academy.onethousanddrones.com/glossary",
    }) as Record<string, unknown>;
    expect(d["@type"]).toBe("DefinedTerm");
    expect(d.name).toBe("Embodied Motor Imagery");
    expect((d.inDefinedTermSet as Record<string, unknown>).url).toContain("/glossary");
  });
});

describe("organizationJsonLd", () => {
  it("carries the verifiable CAGE + UEI identifiers and knowsAbout topics", () => {
    const o = organizationJsonLd() as Record<string, unknown>;
    expect(o["@type"]).toBe("Organization");
    expect(o["@id"]).toContain("#organization");
    const ids = o.identifier as { name: string; value: string }[];
    expect(ids.find((i) => i.name === "CAGE")?.value).toBe("1ZYS4");
    expect(ids.find((i) => i.name === "UEI")?.value).toBe("WDQXD9L9UFH3");
    expect(o.knowsAbout).toContain("KiCad");
    expect(o.legalName).toBe("One Thousand Drones LLC");
  });
});

describe("aboutPageJsonLd", () => {
  it("is an AboutPage that references the org node by @id (single-source entity)", () => {
    const a = aboutPageJsonLd({
      url: "https://academy.onethousanddrones.com/about",
    }) as Record<string, unknown>;
    expect(a["@type"]).toBe("AboutPage");
    expect(a.url).toContain("/about");
    expect((a.mainEntity as Record<string, unknown>)["@id"]).toContain("#organization");
  });
});
