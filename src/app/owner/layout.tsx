import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/server";
import { OwnerShell } from "@/components/layout/OwnerShell";

export const metadata: Metadata = {
  title: "Host dashboard",
  robots: { index: false, follow: false },
};

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole("owner", "/owner");

  return <OwnerShell profile={profile}>{children}</OwnerShell>;
}
