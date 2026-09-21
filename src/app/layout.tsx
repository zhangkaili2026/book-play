import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "书游引擎 · BookPlay",
  description: "阅读为主、影响为辅的互动小说网页应用，数据只存本地。",
};

// 首屏前读取主题偏好，避免闪烁
const themeScript = `try{var t=localStorage.getItem('bookplay.theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
