import { Mail, MessagesSquare, Map } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ContactForm } from "@/components/marketing/ContactForm";

const NEXT_STEPS = [
  { icon: Mail, text: "We reply by email, usually within two business days." },
  { icon: MessagesSquare, text: "A short call to understand your work and the data you already have." },
  { icon: Map, text: "We show you RippleMap with a map built around your own sites." },
];

export function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-12">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="rm-eyebrow mb-3">Contact</p>
          <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">Let&rsquo;s talk about your impact.</h2>
          <p className="mt-4 max-w-md text-lg leading-[1.55] text-text-secondary">
            Questions about RippleMap, plans, or moving your maps over? Send us a note.
          </p>
          <p className="rm-eyebrow mb-4 mt-10">What happens next</p>
          <ul className="space-y-4">
            {NEXT_STEPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-surface-card">
                  <Icon className="h-4 w-4 text-[var(--green-700)]" aria-hidden="true" />
                </span>
                <span className="pt-1.5 text-[15px] leading-relaxed text-text-secondary">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <Card className="relative p-6 sm:p-8">
          <ContactForm />
        </Card>
      </div>
    </section>
  );
}
