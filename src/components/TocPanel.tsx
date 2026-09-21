"use client";

import { useStore } from "@/lib/store";

// 目录面板：列出全部章节，显示进度，点击跳转（桌面侧栏 / 移动端全屏）
export default function TocPanel({ onClose }: { onClose: () => void }) {
  const chapterList = useStore((s) => s.chapterList);
  const currentChapterIndex = useStore((s) => s.currentChapterIndex);
  const gotoChapter = useStore((s) => s.gotoChapter);

  return (
    <div className="fixed inset-0 z-30 flex flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:static md:h-full md:w-72 md:shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-gray-100">目录</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="关闭"
        >
          ✕
        </button>
      </div>

      <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        共 {chapterList.length} 章 · 当前第 {currentChapterIndex + 1} 章
      </div>

      <div className="flex-1 overflow-y-auto">
        {chapterList.map((c) => {
          const active = c.index === currentChapterIndex;
          const read = c.index < currentChapterIndex;
          return (
            <button
              key={c.index}
              onClick={() => {
                gotoChapter(c.index);
                onClose();
              }}
              className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm ${
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                {read && !active && <span className="text-xs text-gray-400 dark:text-gray-500">✓</span>}
                <span className={read && !active ? "text-gray-400 dark:text-gray-500" : ""}>
                  {c.title}
                </span>
              </span>
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {c.charCount} 字
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
