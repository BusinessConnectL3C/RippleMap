"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Menu } from "lucide-react";
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
      <div className={`flex items-center justify-between gap-3 px-4 sm:px-6 ${backHref ? "h-14" : "h-16"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            className="-ml-1 rounded-md p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          {backHref ? (
            // Breadcrumb on one line: "Maps & Apps › Map title".
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
              <Link
                href={backHref}
                className="shrink-0 rounded text-sm font-medium text-text-secondary hover:text-link hover:no-underline"
              >
                <span className="hidden sm:inline">{backLabel ?? "Back"}</span>
                <ArrowLeft className="h-4 w-4 sm:hidden" aria-label={backLabel ?? "Back"} />
              </Link>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-gray-400 sm:block" aria-hidden="true" />
              <h1 className="truncate text-base font-semibold text-gray-900">{title}</h1>
            </nav>
          ) : (
            <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
