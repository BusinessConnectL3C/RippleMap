import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Features } from "@/components/marketing/Features";
import { ImpactBand } from "@/components/marketing/ImpactBand";
import { CTA } from "@/components/marketing/CTA";
import { Footer } from "@/components/marketing/Footer";

export default function MarketingPage() {
  return (
    <div className="bg-surface-page">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ImpactBand />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
