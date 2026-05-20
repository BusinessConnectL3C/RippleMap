import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const isOnboarding = nextUrl.pathname.startsWith("/onboarding");
  const isAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
  const isPortal = nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/maps") ||
    nextUrl.pathname.startsWith("/forms") ||
    nextUrl.pathname.startsWith("/support") ||
    nextUrl.pathname.startsWith("/billing") ||
    nextUrl.pathname.startsWith("/account");

  if (isPortal && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isPortal && isLoggedIn) {
    const onboardingCompleted = (session.user as { onboardingCompleted?: boolean }).onboardingCompleted;
    if (!onboardingCompleted) {
      return NextResponse.redirect(new URL("/onboarding/profile", nextUrl));
    }
  }

  if (isAuth && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/maps/:path*",
    "/forms/:path*",
    "/support/:path*",
    "/billing/:path*",
    "/account/:path*",
    "/onboarding/:path*",
    "/login",
    "/register",
  ],
};
