import Link from "next/link";
import { ArrowRight, BadgeCheck, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RippleViz } from "@/components/marketing/RippleViz";

const STATS: [string, string][] = [
  ["248K", "people reached"],
  ["163", "field sites"],
  ["41", "partners"],
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-11 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[0.86fr_1.14fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-card px-3 py-1.5 pl-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[var(--success)]" />
              <span
                className="absolute -inset-[3px] rounded-full border-[1.5px] border-[var(--success)]"
                style={{ animation: "rm-pulse-dot 2.4s ease-out infinite" }}
              />
            </span>
            <span className="text-[13px] font-semibold text-text-secondary">Live impact mapping</span>
          </div>
          <h1 className="text-[2.6rem] leading-[1.02] tracking-[-0.025em] sm:text-5xl">
            Find the clarity
            <br />
            in your <span className="text-[var(--green-600)]">scattered</span> impact.
          </h1>
          <p className="mt-[22px] max-w-[470px] text-lg leading-[1.55] text-text-secondary">
            RippleMap draws your field reports, sites, and outcomes into one living map — so
            patterns surface on their own and your team spends less time wrangling data, more
            time creating change.
          </p>
          <div className="mt-[30px] flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/register">
                Get started <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">
                <Play className="h-[18px] w-[18px]" /> Watch overview
              </Link>
            </Button>
          </div>
          <div className="mt-[30px] flex items-center gap-2.5">
            <BadgeCheck className="h-4 w-4 text-text-muted" />
            <span className="text-[13px] text-text-muted">Trusted by mission-driven teams in 12 regions</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-[9px] w-[9px] rounded-full bg-neutral-300" />
              ))}
            </span>
            <span className="rm-eyebrow ml-1.5">Impact map</span>
            <span className="ml-auto font-mono text-[11.5px] text-text-muted">East Africa · live</span>
          </div>
          <RippleViz height={392} />
          <div className="grid grid-cols-3 border-t border-border">
            {STATS.map(([v, l], i) => (
              <div key={l} className={`px-[18px] py-3.5 ${i ? "border-l border-border" : ""}`}>
                <div className="font-mono text-xl font-medium text-text-primary">{v}</div>
                <div className="rm-eyebrow mt-[3px]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
