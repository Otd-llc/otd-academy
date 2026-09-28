"use client";

// "Cookie settings": reopens the c15t preference dialog so a visitor can
// withdraw (or give) analytics consent after the banner is gone. GDPR Art. 7(3):
// withdrawing must be as easy as giving, and without this the only way back to
// the choice was clearing site data.
//
// A <button>, not a link: it navigates nowhere. It calls c15t 2.2.1's own
// reopen API, `setActiveUI("dialog")` (the same call its ConsentDialogLink makes
// through the "open-consent-dialog" action), which shows the <ConsentDialog />
// mounted in ConsentProviders. It must render inside ConsentManagerProvider,
// which wraps every route from the root layout.
import { useConsentManager } from "@c15t/nextjs";

export function CookieSettingsButton({ className }: { className?: string }) {
  const { setActiveUI } = useConsentManager();
  return (
    <button
      type="button"
      onClick={() => setActiveUI("dialog")}
      className={className}
      data-testid="cookie-settings"
    >
      Cookie settings
    </button>
  );
}
