import type { Metadata } from "next";
import { isTestSite } from "@/lib/site";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: !isTestSite() },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
