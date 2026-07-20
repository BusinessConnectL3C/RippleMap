"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { useMobileNav } from "@/components/layout/MobileNavContext";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/maps", label: "Maps & Apps", icon: Map },
  { href: "/forms", label: "Forms & Surveys", icon: FileText },
  { href: "/media", label: "Media", icon: Images },
];

const settingsItems = [
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/account", label: "Account", icon: User },
  { href: "/support", label: "Support", icon: HeadphonesIcon },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-brand-subtle text-link"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function SidebarContent({ showMedia, orgName, onNavigate }: { showMedia: boolean; orgName?: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const items = showMedia ? primaryItems : primaryItems.filter((item) => item.href !== "/media");

  return (
    <>
      <div className="flex h-16 flex-col justify-center gap-0.5 border-b border-gray-200 px-6">
        <Link href="/dashboard">
          <Logo type="secondary" tone="black" height={22} />
        </Link>
        <p className="truncate text-xs text-gray-600" title={orgName}>
          {orgName ?? "Client Portal"}
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => (
          <NavLink key={item.href} {...item} isActive={pathname.startsWith(item.href)} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4 space-y-1">
        <p className="rm-eyebrow px-3 mb-1">Settings</p>
        {settingsItems.map((item) => (
          <NavLink key={item.href} {...item} isActive={pathname.startsWith(item.href)} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--green-600)] font-display text-sm font-bold text-white">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{session?.user?.name ?? "Account"}</p>
            <p className="truncate text-xs text-gray-600">{orgName ?? session?.user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );
}

export function Sidebar({ showMedia = false, orgName }: { showMedia?: boolean; orgName?: string }) {
  const { open, setOpen } = useMobileNav();

  return (
    <>
      <aside className="hidden md:flex h-full w-64 flex-col border-r border-gray-200 bg-white">
        <SidebarContent showMedia={showMedia} orgName={orgName} />
      </aside>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] md:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-white shadow-xl md:hidden"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent showMedia={showMedia} orgName={orgName} onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
