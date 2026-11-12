import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";

// Fonts are bundled from @fontsource packages instead of next/font/google:
// fetching from Google Fonts at build time intermittently failed Vercel
// production builds ("next/font/google ... Module not found").
const fontDisplay = localFont({
  src: "../../node_modules/@fontsource-variable/onest/files/onest-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-display",
  display: "swap",
});
// Body copy is Neue Haas Grotesk Display Pro (brand guide), served by Adobe
// Fonts through a web project — Adobe's licence doesn't allow bundling the
// files. Hanken Grotesk stays bundled as the fallback (--font-body-fallback),
// used until the Adobe kit loads or if NEXT_PUBLIC_ADOBE_FONTS_KIT_ID is unset.
const fontBodyFallback = localFont({
  src: "../../node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-body-fallback",
  display: "swap",
});
const adobeFontsKitId = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT_ID?.trim();
const fontMono = localFont({
  src: [
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RippleMap | Client Portal",
  description: "Manage your RippleMap GIS services, maps, forms, and account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBodyFallback.variable} ${fontMono.variable} h-full`}>
      <head>
        {adobeFontsKitId && /^[a-z0-9]+$/i.test(adobeFontsKitId) && (
          <>
            <link rel="preconnect" href="https://use.typekit.net" crossOrigin="" />
            <link rel="stylesheet" href={`https://use.typekit.net/${adobeFontsKitId}.css`} />
          </>
        )}
      </head>
      <body className="h-full bg-surface-page font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
