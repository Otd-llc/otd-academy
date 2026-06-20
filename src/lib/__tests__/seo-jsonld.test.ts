import { describe, it, expect } from "vitest";
import {
  courseJsonLd,
  productJsonLd,
  breadcrumbJsonLd,
  guideCardToHowTo,
  serializeJsonLd,
} from "@/lib/seo/jsonld";

describe("productJsonLd", () => {
  it("emits a schema.org Product with brand, mpn, category, url, datasheet", () => {
    const obj = productJsonLd({
      mpn: "RC0805FR-0710KL",
      manufacturer: "YAGEO",
      description: "10 kΩ 0805 resistor",
      category: "Passive / resistor",
      url: "https://x.test/parts/abc",
      datasheetUrl: "https://x.test/ds.pdf",
    }) as Record<string, unknown>;

    expect(obj["@context"]).toBe("https://schema.org");
    expect(obj["@type"]).toBe("Product");
    expect(obj.name).toBe("RC0805FR-0710KL");
    expect(obj.mpn).toBe("RC0805FR-0710KL");
    expect(obj.description).toBe("10 kΩ 0805 resistor");
    expect(obj.brand).toEqual({ "@type": "Brand", name: "YAGEO" });
    expect(obj.category).toBe("Passive / resistor");
    expect(obj.url).toBe("https://x.test/parts/abc");
    expect(obj.subjectOf).toEqual({
      "@type": "CreativeWork",
      name: "Datasheet",
      url: "https://x.test/ds.pdf",
    });
  });

  it("omits optional fields (description/category/url/datasheet) when absent", () => {
    const obj = productJsonLd({
      mpn: "X",
      manufacturer: "ACME",
      description: null,
      category: null,
      url: "https://x.test/parts/x",
      datasheetUrl: null,
    }) as Record<string, unknown>;
    expect("description" in obj).toBe(false);
    expect("category" in obj).toBe(false);
    expect("subjectOf" in obj).toBe(false);
    expect(obj.brand).toEqual({ "@type": "Brand", name: "ACME" });
  });
});

describe("courseJsonLd", () => {
  it("emits a schema.org Course with the One Thousand Drones provider", () => {
    const obj = courseJsonLd({
      name: "WROOM Breakout",
      description: "A first ESP32 breakout build.",
      level: "L1",
    }) as Record<string, unknown>;

    expect(obj["@context"]).toBe("https://schema.org");
    expect(obj["@type"]).toBe("Course");
    expect(obj.name).toBe("WROOM Breakout");
    expect(obj.description).toBe("A first ESP32 breakout build.");
    expect(obj.provider).toEqual({
      "@type": "Organization",
      name: "One Thousand Drones",
    });
    expect(obj.educationalLevel).toBe("L1");
  });

  it("omits educationalLevel when level is absent", () => {
    const obj = courseJsonLd({
      name: "WROOM Breakout",
      description: "desc",
      level: null,
    }) as Record<string, unknown>;
    expect("educationalLevel" in obj).toBe(false);
  });
});

describe("breadcrumbJsonLd", () => {
  it("emits a BreadcrumbList with positioned itemListElement", () => {
    const obj = breadcrumbJsonLd([
      { name: "Home", url: "https://x.test/" },
      { name: "Courses", url: "https://x.test/courses" },
    ]) as Record<string, unknown>;

    expect(obj["@context"]).toBe("https://schema.org");
    expect(obj["@type"]).toBe("BreadcrumbList");
    expect(obj.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://x.test/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Courses",
        item: "https://x.test/courses",
      },
    ]);
  });
});

describe("guideCardToHowTo", () => {
  it("maps a steps block's items into HowToStep[] with text + count", () => {
    const obj = guideCardToHowTo({
      cardTitle: "Place the module",
      cardLead: "Drop the WROOM and pour the keep-out.",
      contentBlocks: [
        { type: "prose", md: "Some intro prose." },
        {
          type: "steps",
          ordered: true,
          items: ["Open the layout.", "Place the module.", "Pour the keep-out."],
        },
      ],
    }) as Record<string, unknown>;

    expect(obj["@context"]).toBe("https://schema.org");
    expect(obj["@type"]).toBe("HowTo");
    expect(obj.name).toBe("Place the module");
    expect(obj.description).toBe("Drop the WROOM and pour the keep-out.");

    const steps = obj.step as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ "@type": "HowToStep", text: "Open the layout." });
    expect(steps[2]).toEqual({
      "@type": "HowToStep",
      text: "Pour the keep-out.",
    });
  });

  it("concatenates items across multiple steps blocks in order", () => {
    const obj = guideCardToHowTo({
      cardTitle: "Two-part build",
      cardLead: null,
      contentBlocks: [
        { type: "steps", ordered: true, items: ["A", "B"] },
        { type: "prose", md: "interlude" },
        { type: "steps", ordered: false, items: ["C"] },
      ],
    }) as Record<string, unknown>;

    const steps = obj.step as Array<Record<string, unknown>>;
    expect(steps.map((s) => s.text)).toEqual(["A", "B", "C"]);
  });

  it("returns a valid HowTo with no step list when the card has no steps block", () => {
    const obj = guideCardToHowTo({
      cardTitle: "Reading-only card",
      cardLead: "Just prose here.",
      contentBlocks: [{ type: "prose", md: "No steps at all." }],
    }) as Record<string, unknown>;

    expect(obj["@context"]).toBe("https://schema.org");
    expect(obj["@type"]).toBe("HowTo");
    expect(obj.name).toBe("Reading-only card");
    // No steps block → omit `step` (still a valid HowTo).
    expect("step" in obj).toBe(false);
  });
});

describe("serializeJsonLd", () => {
  it("escapes `</script>` so a malicious string cannot break out of the <script> element", () => {
    const out = serializeJsonLd({
      name: "Hello </script><script>alert(1)</script>",
    });

    // The literal closing-script sequence must NOT survive — otherwise the
    // injected markup would terminate the JSON-LD <script> and run as live HTML.
    expect(out).not.toContain("</script>");
    // `<` must be emitted as its unicode escape inside the JSON string.
    expect(out).toContain("\\u003c");
  });

  it("is value-preserving — JSON.parse(serializeJsonLd(x)) deep-equals x", () => {
    const x = {
      name: "Hello </script><script>alert(1)</script>",
      nested: { lt: "<", gt: ">", amp: "&" },
      list: ["a < b", "c > d", "e & f"],
    };
    // `<` etc. are valid JSON escapes that parse back to the raw chars, so
    // the round-trip is lossless for JSON-LD consumers.
    expect(JSON.parse(serializeJsonLd(x))).toEqual(x);
  });
});
