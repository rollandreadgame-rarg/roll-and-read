import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";

const IS_E2E = process.env.NEXT_PUBLIC_E2E_MODE === "true";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

function e2eMiddleware(req: NextRequest) {
  return NextResponse.next();
}

const clerkHandler = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect signed-in users away from landing/sign-in/sign-up to /play
  if (userId && (req.nextUrl.pathname === "/" || req.nextUrl.pathname === "/sign-in" || req.nextUrl.pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/play", req.url));
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default IS_E2E ? e2eMiddleware : clerkHandler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
