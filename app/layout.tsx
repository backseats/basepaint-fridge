import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BasePaint Fridge - Interactive Pixel Art Magnet Canvas",
  description: "Create your own fridge art with BasePaint magnets. Drag, drop, resize, and arrange pixel art pieces on a virtual fridge canvas. Save and share your unique compositions.",
  keywords: ["BasePaint", "pixel art", "NFT", "Base", "coinbase", "fridge magnets", "interactive art", "digital art", "blockchain art", "creative tool"],
  authors: [{ name: "Backseats" }],
  creator: "Backseats",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'BasePaint Fridge',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "BasePaint Fridge - Interactive Pixel Art Magnet Canvas",
    description: "Create your own fridge art with BasePaint magnets. Drag, drop, resize, and arrange pixel art pieces on a virtual fridge canvas.",
    siteName: "BasePaint Fridge",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 1200,
        alt: "BasePaint Fridge - Create pixel art compositions with fridge magnets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BasePaint Fridge - Interactive Pixel Art Magnet Canvas",
    description: "Create your own fridge art with BasePaint magnets. Drag, drop, resize, and arrange pixel art pieces.",
    images: ["/og-image.png"],
    creator: "@backseats_eth",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
