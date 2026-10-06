import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AccountProvider } from "@/components/providers/AccountContext";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { Toaster } from "@/components/ui/toaster";
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
  title: {
    default: "Trading Journal Pro",
    template: "%s · Trading Journal Pro",
  },
  description: "Professional trading journal for serious traders - track, analyze, and improve your trading performance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MotionProvider>
          <QueryProvider>
            <AccountProvider>
              {children}
            </AccountProvider>
          </QueryProvider>
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}

