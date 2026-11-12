import { ArrowRight, Map as MapIcon, Send, Upload, type LucideIcon } from "lucide-react";

const STEPS: { n: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    n: "01",
    icon: MapIcon,
    title: "Start with your map",
    body: "We set up your private workspace. Begin from a ready-made template, or have our team build your first map with you.",
  },
  {
    n: "02",
    icon: Upload,
    title: "Bring in your data",
    body: "Upload spreadsheets, GeoJSON, KML and more, or link a Google Sheet. When new results come in, replace a layer's data and keep its styling.",
  },
  {
    n: "03",
    icon: Send,
    title: "Share what matters",
    body: "Keep maps private, open them to your whole team or specific people, or publish a public link funders and partners can understand at a glance.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-14 sm:px-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="rm-eyebrow mb-3">How it works</p>
          <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">
            From scattered data to a map you can share, in three steps.
          </h2>
        </div>
        <a href="#features" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--green-700)]">
          Explore features <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-3">
        <div
          className="absolute top-[22px] left-[16%] right-[16%] hidden border-t-[1.5px] border-dashed border-[var(--brand-border)] sm:block"
          aria-hidden="true"
        />
        {STEPS.map(({ n, icon: Icon, title, body }) => (
          <div key={n} className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-[var(--brand-border)] bg-surface-page">
                <Icon className="h-5 w-5 text-[var(--green-700)]" />
              </span>
              <span className="font-mono text-sm text-text-muted">{n}</span>
            </div>
            <h3 className="mb-2 text-lg">{title}</h3>
            <p className="max-w-[320px] text-[15px] leading-relaxed text-text-secondary">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
