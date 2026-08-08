import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import {Navbar} from "@/components/Navbar";
import {Providers} from "./providers";
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
  title: "Co-Op Protocol",
  description:
    "Cooperative treasury workspaces with threshold-approved expenses and soulbound contribution attestations.",
};

export default function RootLayout({children}: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
