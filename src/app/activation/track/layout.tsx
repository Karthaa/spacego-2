import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track an activation request",
  description:
    "Check the status of a property activation request with your reference and email.",
  alternates: { canonical: "/activation/track" },
};

export default function ActivationTrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
