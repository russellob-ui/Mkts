import { NextResponse, type NextRequest } from "next/server";

// Sweep isolation guarantee — see docs/fantasy/FINAL_PLAN.md §2.
// When FANTASY_ENABLED !== "true", every /fantasy/* request (UI or API)
// is redirected away. Flipping the env var off in Vercel kills the
// entire feature in <60s without a redeploy, leaving sweep untouched.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isFantasyPath =
    pathname.startsWith("/fantasy") ||
    pathname.startsWith("/api/fantasy") ||
    pathname.startsWith("/api/admin/fantasy") ||
    pathname.startsWith("/api/cron/fantasy");

  if (!isFantasyPath) return NextResponse.next();

  if (process.env.FANTASY_ENABLED === "true") return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Fantasy feature is disabled" },
      { status: 503 }
    );
  }
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: ["/fantasy/:path*", "/api/fantasy/:path*", "/api/admin/fantasy/:path*", "/api/cron/fantasy/:path*"],
};
