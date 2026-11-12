import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Features } from "@/components/marketing/Features";
import { Plans } from "@/components/marketing/Plans";
import { CTA } from "@/components/marketing/CTA";
import { ContactSection } from "@/components/marketing/ContactSection";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "RippleMap | Impact mapping for mission-driven teams",
  description:
    "Private, shareable maps of your sites, field data, and outcomes, set up by our team and managed from one simple portal.",
};

export default function MarketingPage() {
  return (
    <div className="bg-surface-page">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Plans />
        <CTA />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
