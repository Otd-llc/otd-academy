"use client";

// The /hex → configurator hop, counted.
//
// This link is the ONLY channel back to us that actually works. CC BY
// attribution renders on-platform as a remix link to the source model, not to
// our domain, so "attribution drives traffic" is largely false; what drives it
// is somebody clicking through from the spec page to the configurator. That
// makes this the click worth instrumenting.
//
// It is also a CROSS-PROPERTY hop: the configurator is a separate deploy, so
// nothing on the far side can report the arrival back to this page. Firing on
// click here is the only place the two halves can be joined, which is why this
// is a client component at all.
//
// On the id handoff: academy.onethousanddrones.com and demo.onethousanddrones.com
// are sub-domains of ONE registrable domain, and PostHog's cookie is written to
// `.onethousanddrones.com`, so the person id already crosses on its own. The
// explicit `?ph_did=` is therefore belt-and-braces for identity -- but it is
// NOT redundant, because it is also the configurator's consent signal: that app
// has no banner and refuses to initialise without it (see bioscale-viz
// `src/analytics.ts`).
//
// A plain <a>, not next/link: the destination is another origin.
import { trackCtaClicked } from "@/lib/analytics-client";
import { getPosthog } from "@/lib/posthog-client";

/** The query parameter the configurator reads its inbound person id from.
 *  Must match `CROSS_DOMAIN_PARAM` in bioscale-viz `src/analytics.ts`. */
const CROSS_DOMAIN_PARAM = "ph_did";

export function ConfiguratorLink({
  href,
  className,
  children,
  /** Where on the page the click came from, so two links can be told apart. */
  placement,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  placement: string;
}) {
  // Two separate domains cannot share a cookie, so without this the same human
  // is two anonymous strangers and the funnel never joins. Hand our person id
  // across; the configurator bootstraps PostHog with it and strips it from its
  // own address bar so it cannot leak into a shared build link.
  //
  // Done on CLICK rather than at render because the id is only knowable in the
  // browser: baking it into the href server-side would put one visitor's id in
  // a cached/prerendered page and hand it to everyone who saw it after.
  function handoff(e: React.MouseEvent<HTMLAnchorElement>) {
    trackCtaClicked("hex_configurator", { placement });

    // Let the browser do its normal thing for new-tab / middle / modified
    // clicks; hijacking those would break an expectation for a metric.
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }

    // preventDefault MUST be synchronous. This was `async` with the
    // preventDefault after `await getPosthog()`, and by then the browser has
    // already followed the link -- the id was appended to a URL nobody
    // navigated to. It worked locally, where the promise happened to resolve
    // inside the same task, and silently did nothing in production. A await
    // before preventDefault is not a slow path, it is a dead one.
    e.preventDefault();

    void (async () => {
      let target = href;
      try {
        const ph = await getPosthog();
        const id = ph?.get_distinct_id?.();
        if (id) {
          const url = new URL(href);
          url.searchParams.set(CROSS_DOMAIN_PARAM, id);
          target = url.toString();
        }
      } catch {
        // No id, or posthog unavailable (declined consent, blocked): fall
        // through to the plain href.
      }
      // Always navigates, on every path. Having cancelled the default, this
      // function now OWNS the navigation: an early return or an unhandled
      // throw above would leave the visitor on a link that does nothing.
      window.location.assign(target);
    })();
  }

  return (
    <a href={href} className={className} onClick={handoff}>
      {children}
    </a>
  );
}
