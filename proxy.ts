// Next 16 route protection (formerly middleware.ts). A fast first gate only: no cookie, no
// entry to the team areas. Every page and server action checks the session itself
// (src/lib/auth/session.ts), because a cookie's presence proves nothing on its own.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/src/lib/auth/cookie";

const OPEN = ["/members/signin", "/members/join"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/members/signin";
  url.search = "";
  return NextResponse.redirect(url);
}

// /designs is team-only until the public vote: unreleased designs must not leak.
export const config = { matcher: ["/members/:path*", "/admin/:path*", "/designs/:path*"] };
