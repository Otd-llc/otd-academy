"use client";

// On the lead-magnet welcome: (1) auto-DOWNLOAD the guide (an `attachment`
// response saves the file without navigating, so this tab stays on the welcome to
// onboard), and (2) mark the signup onboarded so they skip the /start survey. Runs
// exactly once. If the browser blocks the programmatic download, the page's
// "Re-download the guide" link is the user-gesture fallback.
import { useEffect, useRef } from "react";

import { claimLeadMagnet } from "@/lib/actions/lead-magnet";

export function WelcomeClaim({ guide, downloadUrl }: { guide: string; downloadUrl: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();

    void claimLeadMagnet(guide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
