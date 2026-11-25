import type { Metadata } from "next";

// Login and register are indexable; forgot-password and reset-password opt
// out in their own layouts.
export const metadata: Metadata = {
  title: "Account",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
