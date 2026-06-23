import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const userRole = (session?.user as unknown as { role?: string } | undefined)?.role;
  const isAuth = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register");
  const isPortal = nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/maps") ||
    nextUrl.pathname.startsWith("/forms") ||
    nextUrl.pathname.startsWith("/support") ||
    nextUrl.pathname.startsWith("/billing") ||
    nextUrl.pathname.startsWith("/account");
  const isAdmin = nextUrl.pathname.startsWith("/admin");

  if ((isPortal || isAdmin) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isAdmin && userRole !== "BC_STAFF") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
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
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
