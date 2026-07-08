import { BarChart3, Map, Share2, ShieldCheck, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Map,
    title: "Map your work",
    body: "Plot every project and field site on an intuitive map. See your reach at a glance, region by region.",
  },
  {
    icon: BarChart3,
    title: "Measure impact",
    body: "Track the numbers that matter — people reached, sites active, outcomes verified — in one clear place.",
  },
  {
    icon: Share2,
    title: "Grow your network",
    body: "Discover and connect with organizations working in the same regions and sectors as you.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted data",
    body: "Validate and communicate impact with confidence. Reliable across diverse, low-connectivity environments.",
  },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:px-12">
      <div className="mb-10 max-w-xl">
        <p className="rm-eyebrow mb-3">Why RippleMap</p>
        <h2 className="text-3xl sm:text-4xl">Everything you need to see your impact clearly.</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="p-6 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
              <Icon className="h-[22px] w-[22px] text-green-700" />
            </div>
            <h3 className="mb-2 text-lg">{title}</h3>
            <p className="text-[15px] leading-relaxed text-text-secondary">{body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
