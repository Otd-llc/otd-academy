// Module augmentation so the Auth.js session/JWT carry our `UserRole`.
// `session.user.role` is populated from the token in the `session` callback
// (src/auth.ts); the token's `role` is resolved in the `jwt` callback.
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: { role?: UserRole } & import("next-auth").DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}
