import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const isAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
  const isPortal = nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/maps") ||
    nextUrl.pathname.startsWith("/forms") ||
    nextUrl.pathname.startsWith("/support") ||
    nextUrl.pathname.startsWith("/billing") ||
    nextUrl.pathname.startsWith("/account");
  const isAdmin = nextUrl.pathname.startsWith("/admin");

  // Admin is gated on RM Staff in the admin layout and every admin API, against
  // the database. Not here: the JWT's role is only refreshed at sign-in, so a
  // newly granted RM Staff member would be bounced until they signed out.
  if ((isPortal || isAdmin) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
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
    "/verify-email",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
