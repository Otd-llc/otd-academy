// TEMP dev-only sandbox route for the footer redesign. Deleted before the PR.
// Guards itself out of production; the interactive variants live in the client
// component.
import { notFound } from "next/navigation";
import FooterSandbox from "./FooterSandbox";

export const metadata = { title: "Sandbox · footer" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FooterSandbox />;
}
