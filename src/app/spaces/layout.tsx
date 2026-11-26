import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a workspace",
  description:
    "Search coworking desks, private offices, meeting rooms, studios and event spaces. Compare prices and amenities, then request a booking from the host.",
  alternates: { canonical: "/spaces" },
};

export default function SpacesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
