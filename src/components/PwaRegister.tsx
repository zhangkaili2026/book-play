"use client";

import { useEffect, useState } from "react";

// PWA 注册：服务工作者 + 申请持久化存储。
//
// 背景：手机上（尤其 Edge）浏览器会在"关闭标签页 / 后台清理 / 存储空间不足"时
// 清掉站点本地数据，导致存档每次重开都丢。
// 装成 PWA 后浏览器会把它当常驻应用，再配合 navigator.storage.persist()，
// IndexedDB / localStorage 就基本不会被自动清空。
//
// 另外：如果浏览器没有授予"持久化存储"，这里会弹一条一次性提示，
// 建议用户"添加到主屏幕"，让用户明确知道自己的数据到底稳不稳。

const HINT_KEY = "bookplay.persistHintDismissed";

export default function PwaRegister() {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    async function setup() {
      // 1) 注册 Service Worker（离线缓存 + 让浏览器识别为"可安装应用"）
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          // 相对路径：同时兼容 GitHub Pages 子路径(/book-play/)和 Vercel 根路径(/)
          .register("./sw.js")
          .catch(() => {
            // 注册失败（如无痕模式、被禁止）不阻塞应用，静默忽略
          });
      }

      if (!navigator.storage?.persist) return;

      // 2) 申请持久化存储
      try {
        await navigator.storage.persist();
      } catch {
        /* 忽略 */
      }

      // 3) 检查是否真正获得持久化；没有就提示一次（可关闭，不再打扰）
      let persisted = false;
      try {
        persisted = await navigator.storage.persisted();
      } catch {
        /* 忽略 */
      }
      if (!persisted && !localStorage.getItem(HINT_KEY)) {
        setShowHint(true);
      }
    }
    setup();
  }, []);

  if (!showHint) return null;

  function dismiss() {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* 忽略 */
    }
    setShowHint(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[92%] max-w-md rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <span className="flex-1">
          💡 你的数据还没开启「持久化保护」，手机浏览器可能在后台把它清掉。
          建议「添加到主屏幕」装成 App 再玩，存档更稳。
        </span>
        <button
          onClick={dismiss}
          className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-100"
          title="关闭"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
