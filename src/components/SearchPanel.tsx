"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useStore } from "@/lib/store";

interface SearchResult {
  chapterIndex: number;
  title: string;
  snippet: string;
}

// 搜索面板：在当前书里全文搜索关键词，点结果跳到对应章节
export default function SearchPanel({ onClose }: { onClose: () => void }) {
  const currentBookId = useStore((s) => s.currentBookId);
  const gotoChapter = useStore((s) => s.gotoChapter);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // 防抖搜索
  useEffect(() => {
    if (!query.trim() || currentBookId == null) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const q = query.trim().toLowerCase();
      const chapters = await db.chapters.where("bookId").equals(currentBookId).sortBy("index");
      const found: SearchResult[] = [];
      for (const ch of chapters) {
        const idx = ch.content.toLowerCase().indexOf(q);
        if (idx === -1) continue;
        const start = Math.max(0, idx - 20);
        const end = Math.min(ch.content.length, idx + q.length + 30);
        found.push({
          chapterIndex: ch.index,
          title: ch.title,
          snippet:
            (start > 0 ? "…" : "") +
            ch.content.slice(start, end).replace(/\s+/g, " ") +
            (end < ch.content.length ? "…" : ""),
        });
        if (found.length >= 50) break;
      }
      setResults(found);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, currentBookId]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:static md:h-full md:w-80 md:shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-gray-100">搜索</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="关闭"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-gray-100 p-3 dark:border-gray-800">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索当前书的内容…"
          className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {searching ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">搜索中…</p>
        ) : query.trim() && results.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">没有找到「{query}」</p>
        ) : query.trim() ? (
          <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">找到 {results.length} 处</p>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">输入关键词搜索全文</p>
        )}

        <div className="space-y-2">
          {results.map((r) => (
            <button
              key={r.chapterIndex}
              onClick={() => {
                gotoChapter(r.chapterIndex);
                onClose();
              }}
              className="block w-full rounded border border-gray-200 p-2 text-left text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <div className="font-medium text-gray-800 dark:text-gray-200">{r.title}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{r.snippet}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
