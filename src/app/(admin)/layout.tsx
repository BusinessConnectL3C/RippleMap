import { redirect } from "next/navigation";
import { requireStaffViewer } from "@/lib/staff";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { MobileNavProvider } from "@/components/layout/MobileNavContext";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Checked against the database, not the JWT: an RM Staff role removed in
  // admin takes effect on the next page load.
  if (!(await requireStaffViewer())) redirect("/dashboard");

  return (
    <MobileNavProvider>
      <div className="flex h-full">
        <AdminSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </MobileNavProvider>
  );
}
