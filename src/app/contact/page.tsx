import type { Metadata } from "next";
import { Nav } from "@/components/marketing/Nav";
import { ContactSection } from "@/components/marketing/ContactSection";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Contact | RippleMap",
  description: "Questions about RippleMap, plans, or moving your maps over? Send us a note.",
};

export default function ContactPage() {
  return (
    <div className="bg-surface-page">
      <Nav />
      <main>
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
