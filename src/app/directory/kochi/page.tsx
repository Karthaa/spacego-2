import type { Metadata } from "next";
import { Navbar } from "@/components/navigation/Navbar";
import { Footer } from "@/components/navigation/Footer";
import { KochiDirectory } from "@/components/directory/KochiDirectory";

export const metadata: Metadata = {
  title: "Coworking spaces in Kochi",
  description:
    "Real coworking spaces and business centres in Kochi, from public listings. They aren't on SpaceGo yet, so they can't be booked here.",
  alternates: { canonical: "/directory/kochi" },
};

export default function KochiDirectoryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Navbar />
      <main id="main" className="flex-1">
        <KochiDirectory />
      </main>
      <Footer />
    </div>
  );
}
