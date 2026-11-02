import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

// 标题用宋体（只用于页面标题），数字与标签用等宽字体；正文沿用系统中文字体
const display = Noto_Serif_SC({ weight: ["600", "700"], preload: false, display: "swap", variable: "--font-display" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], display: "swap", variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AI Finance 看板",
  description: "个人使用的美股宏观与 AI 产业周期看板",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${display.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
