import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { LingoProvider } from "@/lib/lingo";
import { TranslationLoader } from "@/components/translation-loader";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.className} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LingoProvider>
            {children}
            <TranslationLoader />
            <Toaster />
          </LingoProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
