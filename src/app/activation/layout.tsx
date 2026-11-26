import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activate your property",
  description:
    "Turn an empty or under-used property into bookable workspace. Tell SpaceGo about the space and get a readiness assessment and a plan to list it.",
  alternates: { canonical: "/activation" },
};

export default function ActivationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
