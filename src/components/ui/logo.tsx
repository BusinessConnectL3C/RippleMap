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

export type LogoType = keyof typeof FILES;
export type LogoTone = "black" | "white" | "green";

export interface LogoProps {
  type?: LogoType;
  tone?: LogoTone;
  height?: number;
  className?: string;
}

/** RippleMap Logo — renders the official brand assets. Never redraw the mark. */
export function Logo({ type = "secondary", tone = "black", height = 28, className }: LogoProps) {
  const { width, height: naturalHeight } = DIMENSIONS[type];
  return (
    <Image
      src={`/brand/logos/${FILES[type][tone]}`}
      alt="RippleMap"
      width={width}
      height={naturalHeight}
      style={{ height, width: "auto" }}
      className={cn("shrink-0", className)}
    />
  );
}
