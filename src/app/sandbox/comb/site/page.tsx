// SANDBOX — the vertical comb on the real page shell, at three device sizes.
// DEV ONLY, deleted once the owner has picked.
import { notFound } from "next/navigation";
import { SiteRound } from "./SiteRound";

export default function SiteSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SiteRound />;
}
