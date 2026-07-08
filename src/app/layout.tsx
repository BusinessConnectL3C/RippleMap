import type { Metadata } from "next";
import { Onest, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "@/components/ui/toaster";

const fontDisplay = Onest({ subsets: ["latin"], variable: "--font-display" });
const fontBody = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body" });
const fontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "RippleMap | Client Portal",
  description: "Manage your RippleMap GIS services, maps, forms, and account.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable} h-full`}>
      <body className="h-full bg-surface-page font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
