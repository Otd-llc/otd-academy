// SANDBOX — the /courses go-further comb, restyled toward the lesson ribbon.
// DEV ONLY, deleted once the owner has picked.
import { notFound } from "next/navigation";
import { PathRound } from "./Round";

export default function PathSandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PathRound />;
}
