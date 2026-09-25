"use client";

// The consent box on the Hex Cluster save panel (plan 6.3, decision 1.14).
//
// ONE component for both save surfaces -- the embedded panel on /hex and the
// top-level save page -- so the two cannot word it differently.
//
// It is about THE SAVE, not analytics. Analytics consent is the c15t banner
// (1.14) and nothing here grants or implies it; `hex_save_completed` still goes
// through the consent-gated client analytics exactly as before.
//
// The server re-checks it: `saveHexCluster` refuses `consent !== true` as
// `consent-required`, so a client that drops the box cannot write.

/** OWNER-WORDING: the sentence beside the box. Agent draft, not approved. */
export const SAVE_CONSENT_TEXT =
  "I understand this build is stored with my account, and that anyone with its link or the QR code on its sheet can view it.";
/** OWNER-WORDING: the privacy link's label. Agent draft, not approved. */
export const SAVE_CONSENT_PRIVACY_LABEL = "Privacy";

export function SaveConsent({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        required
        className="mt-1 h-4 w-4 shrink-0 accent-command-gold"
      />
      <label htmlFor={id} className="font-serif text-xs leading-relaxed text-muted">
        {SAVE_CONSENT_TEXT}{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener"
          className="text-command-gold underline underline-offset-4"
        >
          {SAVE_CONSENT_PRIVACY_LABEL}
        </a>
      </label>
    </div>
  );
}
