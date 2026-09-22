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
  // Open Graph and Twitter images are declared as site-relative paths (see
  // app/anyderm/page.tsx), and Next needs an absolute origin to expand them
  // against. Without this it falls back to http://localhost:3000 at build time
  // and every share card ships pointing at a machine nobody else can reach.
  metadataBase: new URL("https://roshankern.com"),
  title: "Roshan Kern",
  description: "Roshan Kern's personal website",
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
