const STATS: [string, string][] = [
  ["248K", "People reached"],
  ["163", "Field sites mapped"],
  ["41", "Partner organizations"],
  ["12", "Regions served"],
];

export function ImpactBand() {
  return (
    <section id="impact" className="mt-8 bg-[var(--deep-grey)] px-6 py-14 sm:px-12">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 sm:grid-cols-4">
        {STATS.map(([value, label]) => (
          <div key={label}>
            <div className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{value}</div>
            <div className="mt-2 text-sm text-gray-300">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
