// Refreshes the on-device record of the signed-in identity, on EVERY route.
//
// It renders no DOM — it exists so a later signed-OUT visit can be greeted by the
// C1 "welcome back" fast-path on /sign-in (SignInForms reads what RememberLastUser
// writes).
//
// It lives in the ROOT layout, not in the header, and that placement is
// load-bearing. Before the route groups it rode along inside AppHeader, which the
// root layout rendered on every route and which wrote the memo even when the chrome
// itself was gated off — deliberately, so the memo also refreshed on /sign-in (which
// the footer links to) and /embed/*. Now that chrome is scoped to the (chrome) group,
// putting this in the header would quietly narrow that fast-path to chrome routes
// only. Nothing would break; the "welcome back" screen would just stop knowing you.
//
// Being DOM-less, it costs no layout shift wherever it sits, so the root layout is
// the honest home for it.
import { currentAccount } from "@/lib/current-account";
import { RememberLastUser } from "@/components/auth/RememberLastUser";

export async function IdentityMemo() {
  const account = await currentAccount();
  if (!account) return null;
  return (
    <RememberLastUser
      email={account.email}
      name={account.name}
      image={account.image}
    />
  );
}
