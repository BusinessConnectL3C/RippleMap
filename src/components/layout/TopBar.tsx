"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Menu } from "lucide-react";
import { useMobileNav } from "@/components/layout/MobileNavContext";

interface TopBarProps {
  title: string;
  backHref?: string;
  backLabel?: string;
}

export function TopBar({ title, backHref, backLabel }: TopBarProps) {
  const { data: session } = useSession();
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
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white text-sm font-medium">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
            <p className="text-xs text-gray-600">{session?.user?.email}</p>
          </div>
        </div>
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
