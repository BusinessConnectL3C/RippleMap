"use client";

import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { useMobileNav } from "@/components/layout/MobileNavContext";

interface TopBarProps {
  title: string;
  backHref?: string;
  backLabel?: string;
  /** Page-level actions, shown on the right of the title. */
  actions?: React.ReactNode;
}

export function TopBar({ title, backHref, backLabel, actions }: TopBarProps) {
  const { setOpen } = useMobileNav();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            className="-ml-1 rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {backHref && (
        <div className="px-4 pb-3 sm:px-6">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-link hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            {backLabel ?? "Back"}
          </Link>
        </div>
      )}
    </header>
  );
}
