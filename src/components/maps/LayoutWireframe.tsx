import { useId } from "react";
import { cn } from "@/lib/utils";

/** One item of a print layout, in fractions of the page (see PreviewItem in src/lib/felt/print.ts). */
export interface WireframeItem {
  type: "map" | "locator" | "legend" | "text" | "image" | "section";
  x: number;
  y: number;
  w: number;
  h: number;
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  fill?: string | null;
}

interface Props {
  /** width / height of the page. */
  aspect: number;
  /** Null while the layout's structure is loading. */
  items: WireframeItem[] | null;
  className?: string;
}

const H = 1000;

// Soft "terrain" shapes drawn inside map frames, like Felt's layout picker.
const BLOBS = [
  "M0.05,0.35 C0.12,0.15 0.3,0.18 0.36,0.32 C0.42,0.46 0.3,0.6 0.18,0.58 C0.06,0.56 -0.02,0.5 0.05,0.35 Z",
  "M0.55,0.08 C0.7,0.02 0.86,0.1 0.9,0.24 C0.94,0.38 0.78,0.44 0.66,0.4 C0.54,0.36 0.44,0.16 0.55,0.08 Z",
  "M0.48,0.62 C0.6,0.52 0.82,0.58 0.88,0.72 C0.94,0.88 0.74,0.98 0.58,0.94 C0.44,0.9 0.38,0.72 0.48,0.62 Z",
  "M0.02,0.78 C0.1,0.7 0.24,0.74 0.28,0.86 C0.32,0.98 0.12,1.04 0.04,0.96 C-0.02,0.9 -0.02,0.82 0.02,0.78 Z",
];

function MapFrame({ x, y, w, h, locator, uid, dots }: { x: number; y: number; w: number; h: number; locator: boolean; uid: string; dots: string }) {
  return (
    <g>
      <clipPath id={`${uid}-clip`}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <rect x={x} y={y} width={w} height={h} fill="#EEF0E8" />
      <g clipPath={`url(#${uid}-clip)`}>
        <rect x={x} y={y} width={w} height={h} fill={`url(#${dots})`} />
        {BLOBS.map((d, i) => (
          <path
            key={i}
            d={d}
            transform={`translate(${x} ${y}) scale(${w} ${h})`}
            fill={i % 2 ? "#D5DCC4" : "#DDE3CF"}
            stroke="#C4CCAF"
            strokeWidth={1.5 / Math.max(w, h)}
          />
        ))}
      </g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={locator ? "#8F977F" : "#B9BEAE"} strokeWidth={locator ? 3 : 2} />
    </g>
  );
}

function TextLines({ x, y, w, h, size, bold, align }: { x: number; y: number; w: number; h: number; size: number; bold?: boolean; align?: string }) {
  const thickness = Math.max(5, size * 0.55);
  const step = Math.max(thickness * 2.1, size * 1.35);
  const count = Math.max(1, Math.min(8, Math.floor(h / step)));
  const widths = [0.92, 0.78, 0.86, 0.6, 0.88, 0.7, 0.82, 0.5];
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const lw = w * (count === 1 ? 0.85 : widths[i % widths.length]);
        const lx = align === "center" ? x + (w - lw) / 2 : align === "right" ? x + w - lw : x;
        return (
          <rect
            key={i}
            x={lx}
            y={y + i * step + (step - thickness) / 2}
            width={lw}
            height={thickness}
            rx={thickness / 2}
            fill={bold || size > 28 ? "#3A3A37" : "#9A9A93"}
          />
        );
      })}
    </g>
  );
}

function Legend({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const row = Math.min(28, Math.max(12, h / 6));
  const count = Math.max(1, Math.min(7, Math.floor(h / row)));
  const colors = ["#6C8042", "#C9A227", "#4F7CAC", "#C93535", "#8A6FB0", "#3E9C8F", "#B86B3A"];
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <g key={i}>
          {i === 0 ? (
            <rect x={x} y={y + row * 0.3} width={w * 0.45} height={row * 0.32} rx={3} fill="#3A3A37" />
          ) : (
            <>
              <circle cx={x + row * 0.3} cy={y + i * row + row / 2} r={row * 0.2} fill={colors[i % colors.length]} />
              <rect x={x + row * 0.7} y={y + i * row + row * 0.38} width={w * (0.75 - (i % 3) * 0.1)} height={row * 0.24} rx={3} fill="#9A9A93" />
            </>
          )}
        </g>
      ))}
    </g>
  );
}

/** A print layout drawn as a wireframe, like the thumbnails in Felt's layout picker. */
export function LayoutWireframe({ aspect, items, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const W = H * aspect;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("block h-auto w-full rounded-sm bg-white shadow-[0_0_0_1px_var(--border)]", className)}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`${uid}-dots`} width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="9" cy="9" r="1.6" fill="#D2D6C8" />
        </pattern>
      </defs>
      {items === null ? (
        <rect x={W * 0.06} y={H * 0.06} width={W * 0.88} height={H * 0.88} rx={8} fill="#F1F2EE" className="animate-pulse" />
      ) : (
        items.map((it, i) => {
          const x = it.x * W;
          const y = it.y * H;
          const w = it.w * W;
          const h = it.h * H;
          switch (it.type) {
            case "map":
            case "locator":
              return <MapFrame key={i} x={x} y={y} w={w} h={h} locator={it.type === "locator"} uid={`${uid}-${i}`} dots={`${uid}-dots`} />;
            case "section":
              return <rect key={i} x={x} y={y} width={w} height={h} fill={it.fill || "#F1F1EC"} />;
            case "image":
              return (
                <g key={i}>
                  <rect x={x} y={y} width={w} height={h} fill="#E8E8E3" />
                  <path
                    d={`M${x + w * 0.2},${y + h * 0.75} L${x + w * 0.42},${y + h * 0.42} L${x + w * 0.58},${y + h * 0.62} L${x + w * 0.68},${y + h * 0.5} L${x + w * 0.82},${y + h * 0.75} Z`}
                    fill="#C9C9C2"
                  />
                </g>
              );
            case "legend":
              return <Legend key={i} x={x} y={y} w={w} h={h} />;
            case "text":
              return <TextLines key={i} x={x} y={y} w={w} h={h} size={(it.size ?? 0.016) * H} bold={it.bold} align={it.align} />;
            default:
              return null;
          }
        })
      )}
    </svg>
  );
}
