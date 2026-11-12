import { ClipboardList, Globe, HeadphonesIcon, Lock, Smartphone, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RippleViz } from "@/components/marketing/RippleViz";

const ACCESS_LEVELS = [
  { icon: Lock, label: "Restricted", detail: "Owners and admins only" },
  { icon: Users, label: "Your team", detail: "Everyone, or chosen members" },
  { icon: Globe, label: "Public link", detail: "Funders, partners, anyone" },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-12">
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
              Projects, field sites, and results plotted together, with maps and dashboards in one place.
              No more stitching together slides and spreadsheets.
            </p>
          </div>
          <RippleViz height={260} chips={false} className="mt-4" />
        </Card>

        {/* Access control */}
        <Card className="col-span-1 flex flex-col p-7 md:col-span-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
            <Lock className="h-[22px] w-[22px] text-[var(--green-700)]" />
          </div>
          <h3 className="mb-2 text-lg">You decide who sees what</h3>
          <p className="mb-[18px] text-[15px] leading-[1.55] text-text-secondary">
            Every new map starts private. Share it when you&rsquo;re ready, map by map.
          </p>
          <div className="mt-auto flex flex-col gap-2.5">
            {ACCESS_LEVELS.map(({ icon: Icon, label, detail }) => (
              <div key={label} className="flex items-center gap-3 rounded-md border border-border bg-surface-page px-3 py-2.5">
                <Icon className="h-4 w-4 shrink-0 text-[var(--green-700)]" aria-hidden="true" />
                <span className="text-[13.5px] font-semibold text-text-primary">{label}</span>
                <span className="ml-auto text-[13px] text-text-muted">{detail}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Field collection */}
        <Card className="col-span-1 flex flex-col p-7 md:col-span-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent-subtle">
            <Smartphone className="h-[22px] w-[22px] text-[var(--yellow-500)]" />
          </div>
          <h3 className="mb-2 text-lg">Data from the field</h3>
          <p className="text-[15px] leading-[1.55] text-text-secondary">
            Your Field Editor adds and updates sites and observations directly on the map, and your whole team
            sees the results in the portal.
          </p>
        </Card>

        {/* Support + ArcGIS */}
        <Card className="col-span-1 grid gap-7 p-7 sm:grid-cols-2 md:col-span-7">
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
              <HeadphonesIcon className="h-[22px] w-[22px] text-[var(--green-700)]" />
            </div>
            <h3 className="mb-2 text-lg">Real people behind it</h3>
            <p className="text-[15px] leading-[1.55] text-text-secondary">
              Ask for help from the portal and talk to the team that built your maps. Paid plans get priority
              support.
            </p>
          </div>
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-subtle">
              <ClipboardList className="h-[22px] w-[22px] text-[var(--green-700)]" />
            </div>
            <h3 className="mb-2 text-lg">Already on ArcGIS?</h3>
            <p className="text-[15px] leading-[1.55] text-text-secondary">
              Connect your ArcGIS account to see your ArcGIS maps, dashboards, and Survey123 forms in the same
              portal.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
