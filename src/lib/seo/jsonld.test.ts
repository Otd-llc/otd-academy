import { describe, expect, it } from "vitest";
import { techArticleJsonLd, learningResourceJsonLd, definedTermJsonLd } from "@/lib/seo/jsonld";

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
