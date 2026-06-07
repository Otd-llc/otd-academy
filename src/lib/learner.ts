// Server-only helpers for the learner-facing (/learn) pages. There is no auth
// middleware in this app, so each learner page resolves the signed-in user here
// and redirects to /sign-in when there is no session. (Imports @/auth, so this
// only ever runs server-side.)
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function currentUserOrRedirect() {
  const session = await auth();
  if (!session?.user?.email) redirect("/sign-in");
  return db.user.findUniqueOrThrow({
    where: { email: session.user.email },
  });
}
