import { RingField } from "@/components/marketing/RingField";

const STATS: [string, string][] = [
  ["248K", "People reached"],
  ["163", "Field sites mapped"],
  ["41", "Partner organizations"],
  ["12", "Regions served"],
];

export function ImpactBand() {
  return (
    <section id="impact" className="relative mt-8 overflow-hidden bg-[var(--deep-grey)] px-6 py-14 sm:px-12">
      <div className="absolute top-1/2 left-[82%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2">
        <RingField color="rgba(255,255,255,0.9)" opacity={0.12} />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <p className="rm-eyebrow mb-6 text-neutral-400">Impact in numbers · this year</p>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map(([value, label]) => (
            <div key={label} className="border-l-2 border-white/[0.14] pl-[18px]">
              <div className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                {value}
              </div>
              <div className="mt-2.5 text-sm text-neutral-400">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
