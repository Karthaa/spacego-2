import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create a SpaceGo account to book workspaces or list your space.",
  alternates: { canonical: "/auth/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
