import { Check } from "lucide-react";
import { RingField } from "@/components/marketing/RingField";

const PLANS: { name: string; summary: string; items: string[] }[] = [
  {
    name: "Free",
    summary: "Get your organization on the map.",
    items: ["Your own private portal and team", "Maps from ready-made templates", "Upload your own data"],
  },
  {
    name: "Trial",
    summary: "Try RippleMap with your real work.",
    items: ["Everything in Free", "Larger and more frequent uploads", "Time to test it with your team"],
  },
  {
    name: "Paid",
    summary: "For teams that run on their maps.",
    items: ["Everything in Trial", "Large files and unlimited uploads", "Priority support"],
  },
];

export function Plans() {
  return (
    <section id="plans" className="relative mt-8 scroll-mt-24 overflow-hidden bg-[var(--deep-grey)] px-6 py-16 sm:px-0">
      <div className="absolute top-1/2 left-[82%] h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2">
        <RingField color="rgba(255,255,255,0.9)" opacity={0.12} />
      </div>
      <div className="relative mx-auto max-w-6xl sm:px-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="rm-eyebrow mb-3 text-neutral-400">Plans</p>
            <h2 className="text-3xl tracking-[-0.02em] text-white sm:text-4xl">Start free. Grow when you&rsquo;re ready.</h2>
          </div>
          <a href="#contact" className="text-[15px] font-semibold text-white underline-offset-4 hover:text-white">
            Ask us about pricing
          </a>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.name} className="rounded-xl border border-white/[0.14] bg-white/[0.04] p-6">
              <p className="font-display text-2xl font-bold text-white">{plan.name}</p>
              <p className="mt-1.5 text-[15px] text-neutral-300">{plan.summary}</p>
              <ul className="mt-5 space-y-2.5">
                {plan.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[15px] text-neutral-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green-300,#a9c47f)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
