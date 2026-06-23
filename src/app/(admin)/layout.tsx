import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const su = session?.user as unknown as { role?: string } | undefined;

  if (!session?.user?.id || su?.role !== "BC_STAFF") redirect("/dashboard");

  return (
    <div className="flex h-full">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
