"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import ActionPanel from "@/components/ActionPanel";
import CharacterPanel from "@/components/CharacterPanel";

// 阅读器：角色/存档栏 + 章节导航 + 正文 + 行动面板 + 成长面板（侧边栏）
export default function Reader() {
  const chapterList = useStore((s) => s.chapterList);
  const currentChapterIndex = useStore((s) => s.currentChapterIndex);
  const currentContent = useStore((s) => s.currentContent);
  const fontSize = useStore((s) => s.fontSize);
  const lineHeight = useStore((s) => s.lineHeight);
  const currentPC = useStore((s) => s.currentPC);
  const saves = useStore((s) => s.saves);
  const currentSaveId = useStore((s) => s.currentSaveId);
  const gotoChapter = useStore((s) => s.gotoChapter);
  const switchSave = useStore((s) => s.switchSave);
  const openCreator = useStore((s) => s.openCreator);
  const setFontSize = useStore((s) => s.setFontSize);
  const setLineHeight = useStore((s) => s.setLineHeight);

  const [panelOpen, setPanelOpen] = useState(false);

  const chapter = chapterList[currentChapterIndex];
  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < chapterList.length - 1;
  const paragraphs = currentContent.split("\n");

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧：阅读主区 */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* 角色 / 存档栏 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-sm">
          {currentPC ? (
            <>
              <span className="font-semibold text-gray-900">你 · {currentPC.name}</span>
              <span className="text-gray-500">
                {currentPC.identity} · 阵营 {currentPC.faction}
              </span>
            </>
          ) : (
            <>
              <span className="text-gray-500">纯阅读模式 · 尚未开局</span>
              <button
                onClick={openCreator}
                className="font-medium text-blue-600 hover:underline"
              >
                开局 →
              </button>
            </>
          )}

          {currentPC && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-gray-400">存档</span>
              <select
                value={currentSaveId ?? ""}
                onChange={(e) => switchSave(Number(e.target.value))}
                className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
              >
                {saves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={openCreator}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
              >
                ＋新存档
              </button>
              <button
                onClick={() => setPanelOpen((v) => !v)}
                className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
              >
                📋 角色
              </button>
            </div>
          )}
        </div>

        {/* 章节导航 + 阅读设置 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
          <select
            value={currentChapterIndex}
            onChange={(e) => gotoChapter(Number(e.target.value))}
            className="max-w-[16rem] rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {chapterList.map((c) => (
              <option key={c.index} value={c.index}>
                {c.title}
              </option>
            ))}
          </select>

          <span className="text-xs text-gray-400">{chapter?.charCount ?? 0} 字</span>

          <div className="ml-auto flex items-center gap-2 text-sm">
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 1))}
              className="rounded border border-gray-300 px-2 py-1"
              title="缩小字号"
            >
              A−
            </button>
            <button
              onClick={() => setFontSize(Math.min(26, fontSize + 1))}
              className="rounded border border-gray-300 px-2 py-1"
              title="放大字号"
            >
              A+
            </button>
            <button
              onClick={() => setLineHeight(Math.max(1.4, lineHeight - 0.2))}
              className="rounded border border-gray-300 px-2 py-1"
              title="减小行距"
            >
              行距−
            </button>
            <button
              onClick={() => setLineHeight(Math.min(2.6, lineHeight + 0.2))}
              className="rounded border border-gray-300 px-2 py-1"
              title="加大行距"
            >
              行距+
            </button>
          </div>
        </div>

        {/* 正文区（可滚动） */}
        <div className="flex-1 overflow-y-auto bg-[#faf6ef]">
          <article
            className="mx-auto max-w-2xl px-6 py-10"
            style={{ fontSize: `${fontSize}px`, lineHeight }}
          >
            <h1 className="mb-8 text-center text-2xl font-bold text-gray-900">
              {chapter?.title}
            </h1>
            {paragraphs.map((para, i) =>
              para.trim() === "" ? (
                <div key={i} className="h-4" />
              ) : (
                <p key={i} className="mb-3 text-justify indent-8 text-gray-800">
                  {para}
                </p>
              )
            )}
          </article>
        </div>

        {/* 底栏：上一章 / 下一章 */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2">
          <button
            disabled={!hasPrev}
            onClick={() => gotoChapter(currentChapterIndex - 1)}
            className="rounded border border-gray-300 px-4 py-1.5 text-sm disabled:opacity-30"
          >
            ← 上一章
          </button>
          <span className="text-xs text-gray-400">
            {currentChapterIndex + 1} / {chapterList.length}
          </span>
          <button
            disabled={!hasNext}
            onClick={() => gotoChapter(currentChapterIndex + 1)}
            className="rounded border border-gray-300 px-4 py-1.5 text-sm disabled:opacity-30"
          >
            下一章 →
          </button>
        </div>

        {/* 行动面板：偏移度 + 行动输入 */}
        <ActionPanel />
      </div>

      {/* 右侧：成长面板（侧边栏） */}
      {panelOpen && <CharacterPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
