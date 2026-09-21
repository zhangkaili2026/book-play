import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "书游引擎 · BookPlay",
  description: "阅读为主、影响为辅的互动小说网页应用，数据只存本地。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
