"use client";

// Writes the signed-in user's identity to on-device storage so that next time
// they arrive signed-OUT, the sign-in screen can greet them with the C1
// "welcome back" fast-path (SignInForms reads it). Renders nothing; the layout
// mounts it only when there's a session. Same-device convenience, not an auth
// signal — the real gate is server-side, and "Not you?" clears it.

import { useEffect } from "react";
import { LAST_USER_KEY } from "@/lib/last-auth";

export function RememberLastUser({
  email,
  name,
  image,
}: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  useEffect(() => {
    try {
      localStorage.setItem(
        LAST_USER_KEY,
        JSON.stringify({
          email,
          name: name ?? undefined,
          image: image ?? undefined,
        }),
      );
    } catch {
      /* private mode / storage disabled — the fast-path just won't show */
    }
  }, [email, name, image]);

  return null;
}
