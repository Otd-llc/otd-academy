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
//
// It stays a real anchor even where the embed is available, and that is the
// point of the seam below. The href is the standalone configurator, so the link
// works before hydration, with JavaScript off, under the kill switch, and on a
// middle-click or Cmd-click -- all of which are cases where opening an in-page
// frame is either impossible or not what was asked for. The embed is an
// enhancement layered on a link that already worked.
import { useHexConfigurator } from "@/components/hex/hex-configurator-context";
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
  // Null outside a host: on any page that has not opted into a frame, and
  // whenever the kill switch is off. Then everything below is exactly the
  // cross-origin navigation that shipped before the embed existed.
  const frame = useHexConfigurator();

  // Two separate domains cannot share a cookie, so without this the same human
  // is two anonymous strangers and the funnel never joins. Hand our person id
  // across; the configurator bootstraps PostHog with it and strips it from its
  // own address bar so it cannot leak into a shared build link.
  //
  // Done on CLICK rather than at render because the id is only knowable in the
  // browser: baking it into the href server-side would put one visitor's id in
  // a cached/prerendered page and hand it to everyone who saw it after.
  function handoff(e: React.MouseEvent<HTMLAnchorElement>) {
    trackCtaClicked("hex_configurator", { placement, embedded: !!frame });

    // Let the browser do its normal thing for new-tab / middle / modified
    // clicks; hijacking those would break an expectation for a metric. It also
    // leaves a deliberate escape hatch: a Cmd-click still opens the standalone
    // configurator in its own tab, which is what someone who wants two clusters
    // side by side is reaching for.
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

    // The embed. `preventDefault` is synchronous and the rect is read before
    // anything can reflow, so the frame grows out of the button that was
    // actually pressed.
    if (frame) {
      e.preventDefault();
      frame.open({
        placement,
        originRect: e.currentTarget.getBoundingClientRect(),
      });
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
