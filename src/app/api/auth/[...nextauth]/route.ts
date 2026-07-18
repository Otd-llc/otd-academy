import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

export const GET = handlers.GET;

// The raw sign-in endpoint carries no legitimate traffic: the sign-in page, the
// B1 resend button, and the lead-magnet modal all send via in-process server
// actions (Auth(req)), never an HTTP POST here. 404 it to close the Turnstile /
// limiter bypass (design D1): a curl to POST /api/auth/signin/resend can no longer
// reach @auth/core's sendToken. OAuth callbacks (GET /api/auth/callback/*), csrf,
// session, and signout stay open.
export async function POST(req: NextRequest): Promise<Response> {
  const { pathname } = req.nextUrl;
  if (pathname === "/api/auth/signin" || pathname.startsWith("/api/auth/signin/")) {
    return new Response("Not found", { status: 404 });
  }
  return handlers.POST(req);
}
