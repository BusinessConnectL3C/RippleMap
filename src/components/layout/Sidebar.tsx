"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Map,
  FileText,
  HeadphonesIcon,
  CreditCard,
  User,
  LogOut,
  Images,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/maps", label: "Maps & Apps", icon: Map },
  { href: "/media", label: "Media", icon: Images },
  { href: "/forms", label: "Forms & Surveys", icon: FileText },
  { href: "/support", label: "Support", icon: HeadphonesIcon },
];

const settingsItems = [
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/account", label: "Account", icon: User },
];

function NavLink({ href, label, icon: Icon, isActive }: { href: string; label: string; icon: typeof Home; isActive: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-[#EBF5FB] text-[#1B4F72]"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function Sidebar({ showMedia = false, orgName }: { showMedia?: boolean; orgName?: string }) {
  const pathname = usePathname();
  const items = showMedia ? primaryItems : primaryItems.filter((item) => item.href !== "/media");

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1B4F72]">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">RippleMap</p>
          <p className="truncate text-xs text-gray-500" title={orgName}>
            {orgName ?? "Client Portal"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => (
          <NavLink key={item.href} {...item} isActive={pathname.startsWith(item.href)} />
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4 space-y-1">
        <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Settings</p>
        {settingsItems.map((item) => (
          <NavLink key={item.href} {...item} isActive={pathname.startsWith(item.href)} />
        ))}
      </div>

      <div className="border-t border-gray-200 p-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
