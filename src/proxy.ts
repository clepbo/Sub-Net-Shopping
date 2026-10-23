// First line of defence: keeps signed-out users and the wrong roles away
// from protected sections. Every page and server action re-checks the user
// against the database (lib/auth.ts), so this is never the only check.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/session-token";

const SECTIONS: { prefix: string; roles: Role[] | "any" }[] = [
  { prefix: "/merchant", roles: ["SUPERMARKET"] },
  { prefix: "/rider", roles: ["RIDER"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/account", roles: "any" },
  { prefix: "/notifications", roles: "any" },
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const section = SECTIONS.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  if (!section) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (section.roles !== "any" && !section.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/merchant/:path*", "/rider/:path*", "/admin/:path*", "/account/:path*", "/notifications/:path*"],
};
