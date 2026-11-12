"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  return (
    <button type="button" className="text-link hover:underline" onClick={() => signOut({ callbackUrl: "/register" })}>
      {label}
    </button>
  );
}
