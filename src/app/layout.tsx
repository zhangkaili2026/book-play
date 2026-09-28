import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "书游引擎 · BookPlay",
  description: "阅读为主、影响为辅的互动小说网页应用，数据只存本地。",
};

// 关键：告诉手机浏览器按设备宽度渲染，否则整页缩成桌面宽度、按钮点不动
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
        {/* PWA：manifest + 图标 + 主题色，让"添加到主屏幕"后成为独立应用 */}
        <link rel="manifest" href="./manifest.json" />
        <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="书游引擎" />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
