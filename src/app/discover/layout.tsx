import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspaces near you",
  description:
    "Find coworking desks, meeting rooms, private offices and studios near an area or your current location. See them on a map, filter by price and amenities, and request a booking.",
  alternates: { canonical: "/discover" },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
