import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description:
    "Log in to SpaceGo to manage bookings, saved spaces and listings.",
  alternates: { canonical: "/auth/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
