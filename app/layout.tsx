import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LingoProvider } from "@/lib/lingo";
import { TranslationLoader } from "@/components/translation-loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Podcastify - Multilingual Podcast Generator",
  description: "Turn any blog into a multilingual podcast in seconds",
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
        <LingoProvider>
          {children}
          <TranslationLoader />
        </LingoProvider>
      </body>
    </html>
  );
}
