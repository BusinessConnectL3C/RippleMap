import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { ImpactBand } from "@/components/marketing/ImpactBand";
import { CTA } from "@/components/marketing/CTA";
import { Footer } from "@/components/marketing/Footer";

export default function MarketingPage() {
  return (
    <div className="bg-surface-card">
      <Nav />
      <main>
        <Hero />
        <Features />
        <ImpactBand />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
