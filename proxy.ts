import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isBlockedBot } from "@/lib/bots";

const STATIC = /^\/(photos|art|brand|icons)\//;

export async function proxy(request: NextRequest) {
  // AI crawlers and scrapers are turned away everywhere, pictures included.
  if (isBlockedBot(request.headers.get("user-agent"))) {
    return new NextResponse("Not available.", { status: 403, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noai, noimageai" } });
  }
  if (STATIC.test(request.nextUrl.pathname)) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except build files, the service worker and the manifest.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|fonts/|offline).*)",
  ],
};
