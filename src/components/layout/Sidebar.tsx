"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Home,
  Map,
  FileText,
  HeadphonesIcon,
  CreditCard,
  User,
  LogOut,
  Images,
  ShieldCheck,
  Settings,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMobileNav } from "@/components/layout/MobileNavContext";

/** Cookie the portal layout reads so the sidebar renders collapsed on first paint (no flash). */
export const SIDEBAR_COOKIE = "rm-sidebar";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/maps", label: "Maps & Apps", icon: Map },
  { href: "/forms", label: "Forms & Surveys", icon: FileText },
  { href: "/media", label: "Media", icon: Images },
];

const settingsItems = [
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/support", label: "Support", icon: HeadphonesIcon },
];

const itemClass = "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors";
const idleClass = "text-gray-600 hover:bg-gray-50 hover:text-gray-900";

/** Shows a tooltip with the label only when the sidebar is collapsed to icons. */
function RailTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactElement }) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <RailTooltip label={label} collapsed={collapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(itemClass, collapsed && "justify-center px-0", isActive ? "bg-brand-subtle text-link" : idleClass)}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && label}
      </Link>
    </RailTooltip>
  );
}

const menuItemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm font-medium text-gray-700 outline-none data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900";

function UserMenu({
  orgName,
  isStaff,
  collapsed,
  onNavigate,
}: {
  orgName?: string;
  isStaff: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Account";
  const active = pathname.startsWith("/account") || pathname.startsWith("/admin");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-gray-50 data-[state=open]:bg-gray-50",
            collapsed && "justify-center px-0",
            active && "bg-brand-subtle"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--green-600)] font-display text-sm font-bold text-white">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-900">{name}</span>
                <span className="block truncate text-xs text-gray-600">{orgName ?? session?.user?.email}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
            </>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          sideOffset={8}
          className="z-50 w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
            {session?.user?.email && <p className="truncate text-xs text-gray-600">{session.user.email}</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-gray-200" />
          <DropdownMenu.Item asChild className={menuItemClass}>
            <Link href="/account" onClick={onNavigate}>
              <User className="h-4 w-4" /> Account
            </Link>
          </DropdownMenu.Item>
          {isStaff && (
            <DropdownMenu.Item asChild className={menuItemClass}>
              <Link href="/admin" onClick={onNavigate}>
                <ShieldCheck className="h-4 w-4" /> Admin
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-gray-200" />
          <DropdownMenu.Item className={menuItemClass} onSelect={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface SidebarProps {
  showMedia?: boolean;
  orgName?: string;
  /** BC staff (from the database, not the JWT): shows the Admin link. */
  isStaff?: boolean;
  /** Initial desktop state, from the SIDEBAR_COOKIE cookie. */
  defaultCollapsed?: boolean;
  /** The organization's own logo, shown under the RippleMap header. */
  orgLogoUrl?: string | null;
}

function SidebarContent({
  showMedia = false,
  orgName,
  isStaff = false,
  orgLogoUrl = null,
  collapsed = false,
  onToggle,
  onNavigate,
}: Omit<SidebarProps, "defaultCollapsed"> & { collapsed?: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = showMedia ? primaryItems : primaryItems.filter((item) => item.href !== "/media");
  // BC staff handle billing and support in the admin portal instead.
  const settings = isStaff ? [] : settingsItems;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex h-16 shrink-0 items-center border-b border-gray-200", collapsed ? "justify-center px-2" : "gap-2 px-6 pr-3")}>
        {collapsed ? (
          <Link href="/dashboard" aria-label="Home">
            <Logo type="logomark" tone="black" height={24} trim />
          </Link>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
              <Link href="/dashboard">
                <Logo type="secondary" tone="black" height={20} trim />
              </Link>
              <p className="truncate text-xs text-gray-600" title={orgName}>
                {orgName ?? "Client Portal"}
              </p>
            </div>
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {orgLogoUrl && !collapsed && (
        <div className="flex h-14 shrink-0 items-center border-b border-gray-200 px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin redirect to a signed URL */}
          <img src={orgLogoUrl} alt={orgName ? `${orgName} logo` : "Organization logo"} className="max-h-9 max-w-full object-contain" />
        </div>
      )}

      <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
        {collapsed && onToggle && (
          <RailTooltip label="Expand sidebar" collapsed>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              className={cn(itemClass, "w-full justify-center px-0", idleClass)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </RailTooltip>
        )}
        {items.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            isActive={pathname.startsWith(item.href)}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {settings.length > 0 && (
        <div className={cn("space-y-1 border-t border-gray-200", collapsed ? "p-2" : "p-4")}>
          {!collapsed && (
            <p className="rm-eyebrow mb-1 flex items-center gap-1.5 px-3">
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              Settings
            </p>
          )}
          {settings.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              isActive={pathname.startsWith(item.href)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      <div className={cn("border-t border-gray-200", collapsed ? "p-2" : "p-3")}>
        <UserMenu orgName={orgName} isStaff={isStaff} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </TooltipProvider>
  );
}

export function Sidebar({ showMedia = false, orgName, isStaff = false, defaultCollapsed = false, orgLogoUrl = null }: SidebarProps) {
  const { open, setOpen } = useMobileNav();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <>
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent showMedia={showMedia} orgName={orgName} isStaff={isStaff} orgLogoUrl={orgLogoUrl} collapsed={collapsed} onToggle={toggle} />
      </aside>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)] md:hidden" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-white shadow-xl md:hidden"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <SidebarContent showMedia={showMedia} orgName={orgName} isStaff={isStaff} orgLogoUrl={orgLogoUrl} onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
