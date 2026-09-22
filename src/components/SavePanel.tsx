"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

// 存档面板：手动存档 + 自动存档点列表 + 读档/删除
export default function SavePanel({ onClose }: { onClose: () => void }) {
  const savePoints = useStore((s) => s.savePoints);
  const createSavePoint = useStore((s) => s.createSavePoint);
  const restoreSavePoint = useStore((s) => s.restoreSavePoint);
  const deleteSavePoint = useStore((s) => s.deleteSavePoint);

  const [name, setName] = useState("");

  async function handleSave() {
    await createSavePoint(name.trim() || `存档点 ${new Date().toLocaleTimeString()}`);
    setName("");
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:static md:h-full md:w-80 md:shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-gray-100">存档</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="关闭"
        >
          ✕
        </button>
      </div>

      {/* 手动存档 */}
      <div className="border-b border-gray-100 p-3 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="存档点名（可留空）"
            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          />
          <button
            onClick={handleSave}
            className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            ＋ 存档
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          每章结束会自动存一次（保留最近 3 个）。
        </p>
      </div>

      {/* 存档点列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {savePoints.length ? (
          <div className="space-y-2">
            {savePoints.map((sp) => (
              <div key={sp.id} className="rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-gray-800 dark:text-gray-200">
                    {sp.name}
                    {sp.isAuto && <span className="ml-1 text-xs text-gray-400">（自动）</span>}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {new Date(sp.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  第 {sp.chapterIndex + 1} 章 · 偏移 {sp.offset.toFixed(2)} · Lv.{sp.level}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => restoreSavePoint(sp.id!)}
                    className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                  >
                    读档
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("删除这个存档点？")) deleteSavePoint(sp.id!);
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            还没有存档点。翻一章会自动存，或点上方「＋存档」手动存。
          </p>
        )}
      </div>
    </div>
  );
}
