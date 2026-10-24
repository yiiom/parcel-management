import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppFrame from "@/components/app-frame";
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
  title: "大樓包裹管理系統",
  description: "大樓包裹管理系統",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        {/* 既有頁面保留，由共用版型統一導覽與外觀。 */}
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
