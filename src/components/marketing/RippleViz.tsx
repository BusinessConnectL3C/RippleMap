"use client";

/**
 * RippleMap signature visualization: field-site nodes connected by a living
 * mesh, with scattered "raw signal" dots resolving into ordered ripples —
 * the brand's namesake made literal. Pure SVG + CSS keyframes (see
 * globals.css: rm-ripple / rm-node-pulse / rm-dash / rm-chip-in).
 */

type Node = { x: number; y: number; c: string; big?: boolean };

const NODES: Node[] = [
  { x: 20, y: 24, c: "var(--field-green)", big: true },
  { x: 33, y: 13, c: "var(--success)" },
  { x: 41, y: 38, c: "var(--field-green)" },
  { x: 58, y: 27, c: "var(--field-green)", big: true },
  { x: 52, y: 51, c: "var(--success)" },
  { x: 71, y: 44, c: "var(--warning)" },
  { x: 78, y: 20, c: "var(--field-green)" },
  { x: 88, y: 37, c: "var(--success)" },
];

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 6], [4, 5], [5, 6], [5, 7], [6, 7], [3, 5],
];

/** Deterministic scattered "chaos" points, denser toward the edges. */
const CHAOS = (() => {
  let s = 7;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 46 }, () => ({
    x: rnd() * 100,
    y: rnd() * 64,
    o: 0.05 + rnd() * 0.16,
    r: 0.3 + rnd() * 0.5,
  }));
})();

function RippleNode({ n, i }: { n: Node; i: number }) {
  const rings = n.big ? [0, 0.9, 1.8] : [0, 1.1];
  const base = n.big ? 6 : 4.4;
  return (
    <g>
      {rings.map((delay, k) => (
        <circle
          key={k}
          cx={n.x}
          cy={n.y}
          r={base}
          fill="none"
          stroke={n.c}
          strokeWidth="0.5"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: `rm-ripple ${n.big ? 4.2 : 3.4}s ${delay + i * 0.15}s cubic-bezier(0.16,1,0.3,1) infinite`,
          }}
        />
      ))}
      <circle cx={n.x} cy={n.y} r={n.big ? 2.6 : 1.9} fill={n.c} opacity="0.16" />
      <circle
        cx={n.x}
        cy={n.y}
        r={n.big ? 1.5 : 1.15}
        fill={n.c}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: `rm-node-pulse ${3 + i * 0.2}s ${i * 0.1}s ease-in-out infinite`,
        }}
      />
      <circle cx={n.x} cy={n.y} r={n.big ? 0.6 : 0.5} fill="#fff" />
    </g>
  );
}

function DataChip({
  left,
  top,
  value,
  label,
  tone = "default",
}: {
  left: string;
  top: string;
  value: string;
  label: string;
  tone?: "default" | "brand" | "warn";
}) {
  const dot = tone === "brand" ? "var(--field-green)" : tone === "warn" ? "var(--warning)" : "var(--success)";
  return (
    <div
      className="absolute flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-white/92 py-1.5 pl-2.5 pr-3 shadow-md backdrop-blur-sm"
      style={{ left, top, transform: "translate(14px, -50%)", animation: "rm-chip-in 0.6s ease both" }}
    >
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: dot }} />
      <span className="font-mono text-[13px] font-medium text-text-primary">{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

export function RippleViz({
  height = 460,
  chaos = true,
  chips = true,
  className,
}: {
  height?: number;
  chaos?: boolean;
  chips?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className ?? ""}`} style={{ height }} aria-hidden="true">
      <svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" className="block h-full w-full">
        <defs>
          <radialGradient id="rm-glow" cx="45%" cy="42%" r="60%">
            <stop offset="0%" stopColor="var(--green-100)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--yellow-100)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--green-100)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="100" height="64" fill="url(#rm-glow)" />
        <path
          d="M12,30 C16,14 34,8 48,12 C64,17 62,4 78,9 C92,13 96,30 88,42 C82,52 66,50 54,54 C40,59 22,58 15,48 C9,40 9,38 12,30 Z"
          fill="none"
          stroke="var(--neutral-400)"
          strokeWidth="0.35"
          strokeDasharray="1.4 1.6"
          opacity="0.5"
        />

        {chaos &&
          CHAOS.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="var(--neutral-500)" opacity={d.o} />
          ))}

        {EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            stroke="var(--green-500)"
            strokeWidth="0.28"
            opacity="0.4"
            strokeDasharray="0.9 1.1"
            style={{ animation: `rm-dash ${6 + i * 0.4}s linear infinite` }}
          />
        ))}

        {NODES.map((n, i) => (
          <RippleNode key={i} n={n} i={i} />
        ))}
      </svg>

      {chips && (
        <>
          <DataChip left="20%" top="24%" value="8,412" label="reached" />
          <DataChip left="58%" top="27%" value="163" label="sites" tone="brand" />
          <DataChip left="71%" top="44%" value="Review" label="1 flag" tone="warn" />
        </>
      )}
    </div>
  );
}
