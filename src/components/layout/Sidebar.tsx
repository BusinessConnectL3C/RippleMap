"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/maps", label: "Maps", icon: Map },
  { href: "/forms", label: "Forms", icon: FileText },
  { href: "/support", label: "Support", icon: HeadphonesIcon },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/account", label: "Account", icon: User },
];

const mediaNavItem = { href: "/media", label: "Media", icon: Images };

export function Sidebar({ showMedia = false }: { showMedia?: boolean }) {
  const pathname = usePathname();
  const items = showMedia ? [...navItems, mediaNavItem] : navItems;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1B4F72]">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">RippleMap</p>
          <p className="text-xs text-gray-500">Client Portal</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#EBF5FB] text-[#1B4F72]"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

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
