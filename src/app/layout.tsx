import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SpaceGoDataProvider } from "@/context/SpaceGoDataProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpaceGo | Find and book flexible workspaces",
  description:
    "Find the right space. Search coworking desks, private offices, meeting rooms and studios, request a booking, and get confirmed by the host.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
  ],
};

// Runs before first paint so a stored theme choice never flashes. Without a
// stored choice the CSS follows prefers-color-scheme.
const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-canvas text-ink selection:bg-accent selection:text-accent-ink">
        <AuthProvider>
          <SpaceGoDataProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </SpaceGoDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
