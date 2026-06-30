"use client";

import { useState } from "react";

// The "embed this calculator" block on a /tools/[slug] page. Builds the
// copy-paste snippet: a full-width iframe of /embed/[slug] plus a visible
// attribution link. The link is the SEO payload — an <iframe src> alone passes
// little equity, so the host page needs a real <a href> back to the tool. The
// <script> is the resize listener paired with EmbedAutosize; if a host strips
// it, the iframe falls back to its fixed height.
export function EmbedSnippet({
  slug,
  title,
  base,
}: {
  slug: string;
  title: string;
  base: string;
}) {
  const [copied, setCopied] = useState(false);

  const embedUrl = `${base}/embed/${slug}`;
  const toolUrl = `${base}/tools/${slug}`;
  const frameId = `otd-embed-${slug}`;

  const code = [
    `<iframe src="${embedUrl}" id="${frameId}" title="${title}" loading="lazy" style="width:100%;border:0" height="560"></iframe>`,
    `<p style="font:12px/1.5 system-ui,sans-serif;margin:6px 0 0"><a href="${toolUrl}">${title} · One Thousand Drones Academy</a></p>`,
    `<script>window.addEventListener("message",function(e){if(e.origin!=="${base}")return;var d=e.data||{};if(d.otdEmbed==="${slug}"&&d.height){var f=document.getElementById("${frameId}");if(f)f.style.height=d.height+"px";}});</script>`,
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions). The <pre> below is
      // selectable as a manual fallback.
    }
  }

  return (
    <section className="mt-12 border-t border-panel-border/60 pt-6">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
          <span aria-hidden="true">▸ </span>Embed this calculator
        </span>
        <button
          type="button"
          onClick={copy}
          className="glass-button px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Paste this into your own page to drop in the live calculator. Keep the
        attribution link below the frame.
      </p>
      <pre className="mt-3 overflow-x-auto border border-panel-border/60 bg-deep-space px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
        {code}
      </pre>
    </section>
  );
}
