import { requireRole } from "@/lib/auth/server";
import { AdminShell } from "@/components/layout/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("admin", "/admin");

  return <AdminShell profile={profile}>{children}</AdminShell>;
}
