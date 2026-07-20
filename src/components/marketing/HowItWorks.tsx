import { ArrowRight, GitFork, Inbox, Send, type LucideIcon } from "lucide-react";

const STEPS: { n: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    n: "01",
    icon: Inbox,
    title: "Collect the scatter",
    body: "Pull field reports, surveys, and site data out of spreadsheets and inboxes into one shared workspace.",
  },
  {
    n: "02",
    icon: GitFork,
    title: "Map the signal",
    body: "RippleMap plots every site and the ties between them, so patterns and gaps surface without hunting.",
  },
  {
    n: "03",
    icon: Send,
    title: "Communicate impact",
    body: "Share a clear, living map of your work — one link that funders, partners, and boards actually understand.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-14 sm:px-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="rm-eyebrow mb-3">From chaos to clarity</p>
          <h2 className="text-3xl tracking-[-0.02em] sm:text-4xl">
            Three steps from raw signal to a map you can act on.
          </h2>
        </div>
        <a href="#features" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--green-700)]">
          See how it works <ArrowRight className="h-4 w-4" />
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
