import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { PwaInstall } from "@/components/pwa-install";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cursor Local Remote",
  description: "Control Cursor IDE from any device on your local network",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CLR",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0c0e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full overflow-hidden ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className="h-full h-dvh w-full overflow-hidden overscroll-none">
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
