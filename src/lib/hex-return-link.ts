// Where a saved build is reopened: the academy's own framed configurator.
//
// ONE builder for both places that send a reader back to a saved build -- the
// /c/ page's "Open in the configurator" and the top-level save page after a
// save -- so they cannot drift apart.
//
// `/hex?open=1` lands on the spec page with the frame already open
// (HexConfiguratorFrame's deep link); `build=` is the revision's SHARE CODE,
// never a payload. The frame resolves it with `loadHexRecall`, which hands the
// configurator the payload in the IFRAME's fragment and all six identity
// parameters, so the build reopens as the saved, CONTROLLED drawing. The
// payload therefore never touches an academy URL, where PostHog would capture
// it with the fragment.
//
// A plain module (no "use server", no node imports): the save page is a client
// component.
export function savedBuildPath(shareCode: string): string {
  return `/hex?open=1&build=${encodeURIComponent(shareCode)}`;
}
