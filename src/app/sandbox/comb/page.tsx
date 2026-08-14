// SANDBOX — the build-guide and /courses combs, vertical, in one-point perspective.
// DEV ONLY, and deleted once the owner has picked.
//
// The guard is a server component so the dev check runs before any of the round is
// sent; the round itself is a client component because every switch on it is state.
import { notFound } from "next/navigation";
import { CombRound } from "./Round";

export default function CombSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CombRound />;
}
