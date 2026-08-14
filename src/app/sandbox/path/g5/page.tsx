// SANDBOX — G5 convergence for the /courses go-further comb. DEV ONLY.
import { notFound } from "next/navigation";
import { G5Round } from "./Round";

export default function G5Sandbox() {
  if (process.env.NODE_ENV === "production") notFound();
  return <G5Round />;
}
