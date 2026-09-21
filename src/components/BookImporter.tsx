"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";

// 空状态下的全屏导入区：拖拽或点击选择 .txt 文件
export default function BookImporter() {
  const importBook = useStore((s) => s.importBook);
  const loading = useStore((s) => s.loading);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      alert("目前只支持 .txt 文件");
      return;
    }
    await importBook(file);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex w-full max-w-lg cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
            : "border-gray-300 bg-white hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <div className="text-5xl">📖</div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">书游引擎</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? "正在导入并解析章节…" : "拖入一本 .txt 小说，或点击选择文件"}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          原文永不改写 · 数据只存在你浏览器本地 · 看书 0 消耗
        </p>
      </div>
    </main>
  );
}
