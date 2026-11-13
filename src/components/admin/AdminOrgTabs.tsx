"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface AdminOrgTab {
  value: string;
  label: string;
  /** Shown as a small count or marker next to the label. */
  badge?: string | number | null;
  content: ReactNode;
}

/** Tabs for the admin organization page; the open tab is kept in ?tab= so it survives refreshes and links. */
export function AdminOrgTabs({ tabs, active }: { tabs: AdminOrgTab[]; active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = tabs.some((t) => t.value === active) ? active : tabs[0].value;

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === tabs[0].value) params.delete("tab");
        else params.set("tab", next);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    >
      <TabsList className="overflow-x-auto">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
            {t.badge !== undefined && t.badge !== null && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-600">
                {t.badge}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="space-y-6">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
