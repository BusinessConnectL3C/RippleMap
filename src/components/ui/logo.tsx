import Image from "next/image";
import { cn } from "@/lib/utils";

const FILES = {
  wordmark: {
    black: "RippleMap_Wordmark_Black.png",
    white: "RippleMap_Wordmark_White.png",
    green: "RippleMap_Wordmark_Green.png",
  },
  secondary: {
    black: "RippleMap_Secondary_Black.png",
    white: "RippleMap_Secondary_White.png",
    green: "RippleMap_Secondary_Green.png",
  },
  logomark: {
    black: "Logomark_Black.png",
    white: "Logomark_White.png",
    green: "Logomark_Green.png",
  },
} as const;

const DIMENSIONS: Record<keyof typeof FILES, { width: number; height: number }> = {
  wordmark: { width: 4964, height: 1843 },
  secondary: { width: 6185, height: 1845 },
  logomark: { width: 2256, height: 1705 },
};

/** Same art with the transparent padding cropped off (secondary and logomark only). */
const TRIMMED: Partial<Record<keyof typeof FILES, { width: number; height: number }>> = {
  secondary: { width: 1504, height: 240 },
  logomark: { width: 319, height: 240 },
};

export type LogoType = keyof typeof FILES;
export type LogoTone = "black" | "white" | "green";

export interface LogoProps {
  type?: LogoType;
  tone?: LogoTone;
  height?: number;
  className?: string;
  /**
   * Use the padding-free files, so `height` is the height of the art itself.
   * The original files have wide transparent margins (the mark fills about a
   * third of the logomark image), which makes them look tiny at UI sizes.
   */
  trim?: boolean;
}

/** RippleMap Logo — renders the official brand assets. Never redraw the mark. */
export function Logo({ type = "secondary", tone = "black", height = 28, className, trim = false }: LogoProps) {
  const trimmed = trim ? TRIMMED[type] : undefined;
  const { width, height: naturalHeight } = trimmed ?? DIMENSIONS[type];
  const file = trimmed ? FILES[type][tone].replace(/\.png$/, "_Trim.png") : FILES[type][tone];
  return (
    <Image
      src={`/brand/logos/${file}`}
      alt="RippleMap"
      width={width}
      height={naturalHeight}
      style={{ height, width: "auto" }}
      className={cn("shrink-0", className)}
    />
  );
}
