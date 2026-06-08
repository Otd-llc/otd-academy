// <JsonLd> — emits a structured-data object as an inline
// `<script type="application/ld+json">`. Server component (no client JS): the
// JSON is serialized at render and injected via dangerouslySetInnerHTML, which
// is the canonical Next.js pattern for JSON-LD. `data` is one of the plain
// objects from `src/lib/seo/jsonld.ts`.
//
// Serialization goes through `serializeJsonLd`, which escapes `</script>` (and
// the other HTML/JS-sensitive chars) so untrusted JSON-LD field values can't
// break out of the <script> element — a stored-XSS sink on a public page.

import { serializeJsonLd } from "@/lib/seo/jsonld";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
