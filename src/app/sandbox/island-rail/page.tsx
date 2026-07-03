// TEMP dev-only sandbox route for the guide-pacing island rail (Task 3).
// Deleted before the PR (Task 9). Guards itself out of production; the
// interactive variants live in the client component.
import { notFound } from "next/navigation";
import IslandRailSandbox from "./IslandRailSandbox";

export const metadata = { title: "Sandbox · island rail" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <IslandRailSandbox />;
}
