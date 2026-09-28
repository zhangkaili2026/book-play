"use client";

import { useEffect } from "react";

// PWA 注册：服务工作者 + 申请持久化存储。
//
// 背景：手机上（尤其 Edge）浏览器会在"关闭标签页 / 后台清理 / 存储空间不足"时
// 清掉站点本地数据，导致存档每次重开都丢。
// 装成 PWA 后浏览器会把它当常驻应用，再配合 navigator.storage.persist()，
// IndexedDB / localStorage 就基本不会被自动清空。
export default function PwaRegister() {
  useEffect(() => {
    // 1) 注册 Service Worker（离线缓存 + 让浏览器识别为"可安装应用"）
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        // 相对路径：同时兼容 GitHub Pages 子路径(/book-play/)和 Vercel 根路径(/)
        .register("./sw.js")
        .catch(() => {
          // 注册失败（如无痕模式、被禁止）不阻塞应用，静默忽略
        });
    }

    // 2) 申请持久化存储，降低浏览器自动清理本地数据的概率
    if (navigator.storage && typeof navigator.storage.persist === "function") {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  return null;
}
