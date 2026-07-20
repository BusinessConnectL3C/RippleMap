import Link from "next/link";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const PINS = [
  { x: 30, y: 44, status: "default" },
  { x: 58, y: 32, status: "success" },
  { x: 46, y: 66, status: "default" },
  { x: 72, y: 52, status: "default" },
] as const;

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 py-16 sm:px-12 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1.5">
          <Sparkles className="h-[15px] w-[15px] text-link" />
          <span className="text-[13px] font-semibold text-link">Impact, made clear</span>
        </div>
        <h1 className="text-4xl leading-[1.05] sm:text-5xl">
          Understand, measure, and communicate your impact.
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-[1.55] text-text-secondary">
          RippleMap turns scattered project data into a clear, connected map of your work — so
          your team spends less time managing data and more time creating change.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/register">
              Get started <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
        <p className="mt-8 text-[13px] text-text-muted">Trusted by mission-driven teams worldwide</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-card shadow-xl">
        <div
          className="relative h-80"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle at 34% 40%, var(--green-100), transparent 40%), radial-gradient(circle at 70% 66%, var(--yellow-100), transparent 38%), var(--neutral-100)",
          }}
        >
          <div
            className="absolute inset-0 opacity-50"
            style={{ backgroundImage: "radial-gradient(var(--neutral-300) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
          />
          {PINS.map((pin, i) => (
            <span
              key={i}
              className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-[3px] border-white shadow-md ${
                pin.status === "success" ? "bg-green-500" : "bg-brand"
              }`}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              <MapPin className="h-3.5 w-3.5 text-white" />
            </span>
          ))}
        </div>
        <div className="flex gap-3 p-4">
          <div className="flex-1 rounded-md border border-border bg-surface-page p-3">
            <div className="rm-eyebrow">People reached</div>
            <div className="font-display text-2xl font-extrabold text-text-primary">248K</div>
          </div>
          <div className="flex-1 rounded-md border border-border bg-surface-page p-3">
            <div className="rm-eyebrow">Field sites</div>
            <div className="font-display text-2xl font-extrabold text-text-primary">163</div>
          </div>
        </div>
      </div>
    </section>
  );
}
