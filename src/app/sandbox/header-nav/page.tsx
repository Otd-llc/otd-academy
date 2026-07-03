// TEMP dev-only sandbox route for the mobile header nav expand/collapse. Deleted
// before the PR. Guards itself out of production.
import { notFound } from "next/navigation";
import HeaderNavSandbox from "./HeaderNavSandbox";

export const metadata = { title: "Sandbox · header nav" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HeaderNavSandbox />;
}
