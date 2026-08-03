"use client";

// The seam between the "Open the configurator" buttons and the frame that
// opens.
//
// It is a CONTEXT rather than a prop chain because the buttons are rendered by
// a server component several levels down inside prose sections, and threading a
// callback through would have made every one of those sections a client
// component -- which would ship the whole spec page's markup to the browser to
// win nothing.
//
// `useHexConfigurator()` returns NULL outside a host, and that is a supported
// state, not a bug: `ConfiguratorLink` is then a plain cross-origin anchor to
// the standalone configurator, exactly as it was before the embed existed. That
// is what keeps the link working when JavaScript has not arrived yet, when the
// kill switch is off, and on any page that has not opted into hosting a frame.

import { createContext, useContext } from "react";

export interface OpenOptions {
  /** Where on the page the click came from, carried into the analytics event
   *  so two buttons can be told apart. */
  placement: string;
  /** The trigger's viewport rectangle at click time, used to grow the frame
   *  out of the button that opened it. Absent for a programmatic open (a deep
   *  link), which fades in instead. */
  originRect?: DOMRect | null;
}

export interface HexConfiguratorApi {
  open: (options: OpenOptions) => void;
  close: () => void;
  isOpen: boolean;
}

export const HexConfiguratorContext = createContext<HexConfiguratorApi | null>(
  null,
);

export function useHexConfigurator(): HexConfiguratorApi | null {
  return useContext(HexConfiguratorContext);
}
