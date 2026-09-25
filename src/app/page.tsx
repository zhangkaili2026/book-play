"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import BookImporter from "@/components/BookImporter";
import Reader from "@/components/Reader";
import CharacterCreator from "@/components/CharacterCreator";
import SettingsModal from "@/components/SettingsModal";
import ThemeToggle from "@/components/ThemeToggle";
import MurderMystery from "@/components/MurderMystery";

export default function Home() {
  const books = useStore((s) => s.books);
  const currentBookId = useStore((s) => s.currentBookId);
  const showCreator = useStore((s) => s.showCreator);
  const loadBooks = useStore((s) => s.loadBooks);
  const openBook = useStore((s) => s.openBook);
  const importBook = useStore((s) => s.importBook);
  const deleteBook = useStore((s) => s.deleteBook);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [murderOpen, setMurderOpen] = useState(false);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // 一本都没有 → 全屏导入区
  if (books.length === 0) {
    return (
      <>
        <BookImporter />
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
        <div className="fixed right-4 top-4 flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-full border border-gray-300 bg-white p-2 text-gray-600 shadow-sm hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            title="AI 设置"
          >
            ⚙️
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏：书架 + 导入 + 主题 + 设置 */}
      <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
        <span className="mr-2 font-bold text-gray-900 dark:text-gray-100">书游引擎</span>

        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {books.map((b) => (
            <span
              key={b.id}
              className={`group flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                b.id === currentBookId
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
              onClick={() => openBook(b.id!)}
            >
              {b.title}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`删除《${b.title}》及它的所有进度？`)) deleteBook(b.id!);
                }}
                className="text-xs opacity-50 hover:opacity-100"
                title="删除这本书"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="whitespace-nowrap rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
        >
          ＋ 导入
        </button>
        <ThemeToggle />
        <button
          onClick={() => setMurderOpen(true)}
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          title="剧本杀"
        >
          🎭 剧本杀
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          title="AI 设置"
        >
          ⚙️
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importBook(file);
          }}
        />
      </header>

      {/* 主体：未选书 / 开局 / 阅读 */}
      {currentBookId == null ? (
        <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
          点击上方书架里的一本书开始阅读
        </div>
      ) : showCreator ? (
        <CharacterCreator />
      ) : (
        <Reader />
      )}

      {/* AI 设置弹窗 */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* 剧本杀 */}
      {murderOpen && <MurderMystery onClose={() => setMurderOpen(false)} />}
    </div>
  );
}
