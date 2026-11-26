import type { Metadata } from "next";
import { isTestSite } from "@/lib/site";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: !isTestSite() },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
