import { Activity, Share2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RippleViz } from "@/components/marketing/RippleViz";

const METRICS: [string, string, number][] = [
  ["People reached", "248,410", 82],
  ["Sites verified", "141 / 163", 86],
  ["Outcomes logged", "1,204", 64],
];

const AVATARS = ["MK", "AR", "TN", "LO", "+38"];

const TRUST_ITEMS: [string, string][] = [
  ["Verified", "var(--success)"],
  ["Syncing", "var(--warning)"],
  ["Offline queue", "var(--text-muted)"],
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-16 sm:px-12">
      <div className="mb-10 max-w-xl">
        <p className="rm-eyebrow mb-3">Why RippleMap</p>
        <h2 className="text-3xl sm:text-4xl">Everything you need to see your impact clearly.</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        {/* Map — central visualization */}
        <Card className="col-span-1 overflow-hidden md:col-span-7">
          <div className="px-7 pt-7">
            <h3 className="mb-2 text-xl">Your whole footprint, on one map</h3>
            <p className="max-w-[440px] text-[15.5px] leading-relaxed text-text-secondary">
              Every project and field site, plotted and connected. See reach at a glance,
              region by region — no more stitching together slides.
            </p>
          </div>
          <RippleViz height={260} chips={false} className="mt-4" />
        </Card>

        {/* Measure — mono readouts */}
        <Card className="col-span-1 flex flex-col p-7 md:col-span-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
            <Activity className="h-[22px] w-[22px] text-[var(--green-700)]" />
          </div>
          <h3 className="mb-2 text-lg">Measure what matters</h3>
          <p className="mb-[18px] text-[15px] leading-[1.55] text-text-secondary">
            People reached, sites active, outcomes verified — the numbers that move funders,
            kept current.
          </p>
          <div className="mt-auto flex flex-col gap-2.5">
            {METRICS.map(([label, value, pct]) => (
              <div key={label}>
                <div className="mb-[5px] flex justify-between">
                  <span className="text-[13px] text-text-secondary">{label}</span>
                  <span className="font-mono text-[13px] text-text-primary">{value}</span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full rounded-full bg-[var(--field-green)]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Network — avatar stack */}
        <Card className="col-span-1 flex flex-col p-7 md:col-span-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-subtle">
            <Share2 className="h-[22px] w-[22px] text-[var(--yellow-500)]" />
          </div>
          <h3 className="mb-2 text-lg">Grow your network</h3>
          <p className="mb-4 text-[15px] leading-[1.55] text-text-secondary">
            Discover organizations working in the same regions and sectors — and find the
            partners already next door.
          </p>
          <div className="mt-auto flex items-center">
            {AVATARS.map((a, i) => (
              <span
                key={a}
                className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-surface-card text-xs font-semibold ${
                  i === AVATARS.length - 1 ? "bg-surface-page text-text-secondary" : "bg-[var(--green-600)] text-white"
                }`}
                style={{ marginLeft: i ? -8 : 0 }}
              >
                {a}
              </span>
            ))}
          </div>
        </Card>

        {/* Trusted data */}
        <Card className="col-span-1 flex flex-col gap-7 p-7 sm:flex-row sm:items-center md:col-span-7">
          <div className="flex-1">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
              <ShieldCheck className="h-[22px] w-[22px] text-[var(--green-700)]" />
            </div>
            <h3 className="mb-2 text-lg">Trusted, offline-ready data</h3>
            <p className="text-[15px] leading-[1.55] text-text-secondary">
              Validate and communicate with confidence. Built to stay reliable across diverse,
              low-connectivity field environments — syncing the moment you&rsquo;re back online.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:w-[150px]">
            {TRUST_ITEMS.map(([label, color]) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-md border border-border bg-surface-page px-3 py-2.5"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
                <span className="text-[13px] text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
