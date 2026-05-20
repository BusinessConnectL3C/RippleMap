"use client";

import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B4F72] text-white text-sm font-medium">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
            <p className="text-xs text-gray-500">{session?.user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
