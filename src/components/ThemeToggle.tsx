"use client";

import { useEffect, useState } from "react";

// 暗色模式切换按钮：切换 <html> 的 .dark 类 + 存 localStorage
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const html = document.documentElement;
    const next = html.classList.toggle("dark");
    setDark(next);
    localStorage.setItem("bookplay.theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600"
      title={dark ? "切到亮色" : "切到暗色"}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
