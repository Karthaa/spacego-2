import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/server";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata: Metadata = {
  title: "Your dashboard",
  robots: { index: false, follow: false },
};

export default async function SeekerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile("/dashboard");

  return <DashboardShell profile={profile}>{children}</DashboardShell>;
}
