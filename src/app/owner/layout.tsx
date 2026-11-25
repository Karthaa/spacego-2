import { requireRole } from "@/lib/auth/server";
import { OwnerShell } from "@/components/layout/OwnerShell";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("owner", "/owner");

  return <OwnerShell profile={profile}>{children}</OwnerShell>;
}
