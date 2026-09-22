"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, type FontChoice, type ReadingBgChoice } from "@/lib/store";
import ActionPanel from "@/components/ActionPanel";
import CharacterPanel from "@/components/CharacterPanel";
import TocPanel from "@/components/TocPanel";

const FONT_STACKS: Record<FontChoice, string> = {
  serif: '"Songti SC", "SimSun", "STSong", serif',
  sans: '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  kai: '"Kaiti SC", "KaiTi", "STKaiti", serif',
};

const FONT_LABELS: Record<FontChoice, string> = { serif: "宋体", sans: "黑体", kai: "楷体" };

const BG_STYLES: Record<ReadingBgChoice, { bg: string; text: string }> = {
  paper: { bg: "#faf6ef", text: "#1f2937" },
  white: { bg: "#ffffff", text: "#1f2937" },
  green: { bg: "#e8f0e3", text: "#1f2937" },
  dark: { bg: "#1a1a1a", text: "#d1d5db" },
};

const BG_LABELS: Record<ReadingBgChoice, string> = {
  paper: "羊皮纸",
  white: "纯白",
  green: "护眼绿",
  dark: "暗色",
};

// 阅读器：角色/存档栏 + 章节导航 + 正文（含旁注）+ 行动面板 + 侧边抽屉
export default function Reader() {
  const chapterList = useStore((s) => s.chapterList);
  const currentChapterIndex = useStore((s) => s.currentChapterIndex);
  const currentContent = useStore((s) => s.currentContent);
  const fontSize = useStore((s) => s.fontSize);
  const lineHeight = useStore((s) => s.lineHeight);
  const fontFamily = useStore((s) => s.fontFamily);
  const readingBg = useStore((s) => s.readingBg);
  const currentPC = useStore((s) => s.currentPC);
  const saves = useStore((s) => s.saves);
  const currentSaveId = useStore((s) => s.currentSaveId);
  const pureReadMode = useStore((s) => s.pureReadMode);
  const recentActions = useStore((s) => s.recentActions);
  const gotoChapter = useStore((s) => s.gotoChapter);
  const switchSave = useStore((s) => s.switchSave);
  const openCreator = useStore((s) => s.openCreator);
  const setFontSize = useStore((s) => s.setFontSize);
  const setLineHeight = useStore((s) => s.setLineHeight);
  const setFontFamily = useStore((s) => s.setFontFamily);
  const setReadingBg = useStore((s) => s.setReadingBg);
  const togglePureRead = useStore((s) => s.togglePureRead);
  const setSelection = useStore((s) => s.setSelection);

  const [sidePanel, setSidePanel] = useState<"toc" | "character" | null>(null);
  const [aaOpen, setAaOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chapter = chapterList[currentChapterIndex];
  const hasPrev = currentChapterIndex > 0;
  const hasNext = currentChapterIndex < chapterList.length - 1;
  const paragraphs = currentContent.split("\n");
  const bgStyle = BG_STYLES[readingBg];

  // 本章已锚定的行动 → 按段落分组
  const chapterActions = recentActions.filter(
    (a) => a.chapterIndex === currentChapterIndex && a.paraIndex != null
  );
  const notesByPara = new Map<number, typeof chapterActions>();
  for (const a of chapterActions) {
    const list = notesByPara.get(a.paraIndex!) ?? [];
    list.push(a);
    notesByPara.set(a.paraIndex!, list);
  }

  // 翻章后回到顶部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [currentChapterIndex]);

  // 键盘快捷键：← / → 翻章（输入框内不触发）
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "ArrowLeft" && hasPrev) gotoChapter(currentChapterIndex - 1);
      if (e.key === "ArrowRight" && hasNext) gotoChapter(currentChapterIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentChapterIndex, hasPrev, hasNext, gotoChapter]);

  // 捕获选中的段落（selectionchange + 防抖，鼠标/触摸通用，支持手机）
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function onSelectionChange() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        // 没选区 / 选区折叠 / 不在正文段落里 → 保留原锚点，不清除
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
        const node = sel.anchorNode;
        const el =
          node?.nodeType === 1
            ? (node as Element).closest("[data-para-index]")
            : node?.parentElement?.closest("[data-para-index]");
        const text = sel.toString().trim();
        if (!el || !text) return;
        setSelection({ paraIndex: Number(el.getAttribute("data-para-index")), text });
      }, 250);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [setSelection]);

  const btnCls =
    "rounded border border-gray-300 px-2 py-1 dark:border-gray-600";

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧：阅读主区 */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* 角色 / 存档栏 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800/50">
          {currentPC ? (
            <>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                你 · {currentPC.name}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {currentPC.identity} · 阵营 {currentPC.faction}
              </span>
            </>
          ) : (
            <>
              <span className="text-gray-500 dark:text-gray-400">纯阅读模式 · 尚未开局</span>
              <button
                onClick={openCreator}
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                开局 →
              </button>
            </>
          )}

          {currentPC && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500">存档</span>
              <select
                value={currentSaveId ?? ""}
                onChange={(e) => switchSave(Number(e.target.value))}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                {saves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={openCreator}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                ＋新存档
              </button>
              <button
                onClick={() => setSidePanel(sidePanel === "character" ? null : "character")}
                className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                📋 角色
              </button>
            </div>
          )}
        </div>

        {/* 章节导航 + 阅读设置 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
          <button
            onClick={() => setSidePanel(sidePanel === "toc" ? null : "toc")}
            className={btnCls + " text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}
            title="目录"
          >
            📑 目录
          </button>
          <span className="truncate text-sm text-gray-700 dark:text-gray-300">
            {chapter?.title}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {chapter?.charCount ?? 0} 字
          </span>

          <div className="ml-auto flex items-center gap-2 text-sm">
            {/* Aa 阅读设置 */}
            <div className="relative">
              <button
                onClick={() => setAaOpen((v) => !v)}
                className={btnCls + " font-serif text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}
                title="阅读设置"
              >
                Aa
              </button>
              {aaOpen && (
                <div className="absolute right-0 z-20 mt-1 w-60 rounded border border-gray-200 bg-white p-3 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">字号</span>
                    <div className="flex gap-1">
                      <button onClick={() => setFontSize(Math.max(14, fontSize - 1))} className={btnCls}>A−</button>
                      <button onClick={() => setFontSize(Math.min(26, fontSize + 1))} className={btnCls}>A+</button>
                    </div>
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">行距</span>
                    <div className="flex gap-1">
                      <button onClick={() => setLineHeight(Math.max(1.4, lineHeight - 0.2))} className={btnCls}>−</button>
                      <button onClick={() => setLineHeight(Math.min(2.6, lineHeight + 0.2))} className={btnCls}>+</button>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="mb-1 text-gray-500 dark:text-gray-400">字体</div>
                    <div className="flex gap-1">
                      {(Object.keys(FONT_LABELS) as FontChoice[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFontFamily(f)}
                          className={`flex-1 rounded border px-1 py-1 ${
                            fontFamily === f
                              ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
                              : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                          }`}
                        >
                          {FONT_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-gray-500 dark:text-gray-400">背景</div>
                    <div className="flex gap-1">
                      {(Object.keys(BG_LABELS) as ReadingBgChoice[]).map((b) => (
                        <button
                          key={b}
                          onClick={() => setReadingBg(b)}
                          className={`flex-1 rounded border px-1 py-1 ${
                            readingBg === b
                              ? "border-blue-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                          style={{ backgroundColor: BG_STYLES[b].bg, color: BG_STYLES[b].text }}
                        >
                          {BG_LABELS[b]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={togglePureRead}
              className={`rounded border px-2 py-1 text-xs ${
                pureReadMode
                  ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-400"
                  : "border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
              title="纯阅读模式（隐藏行动面板）"
            >
              👁 纯阅读
            </button>
          </div>
        </div>

        {/* 正文区（可滚动，含旁注图标） */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: bgStyle.bg, color: bgStyle.text }}
        >
          <article
            className="mx-auto max-w-2xl px-6 py-10"
            style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily: FONT_STACKS[fontFamily] }}
          >
            <h1 className="mb-8 text-center text-2xl font-bold">{chapter?.title}</h1>
            {paragraphs.map((para, i) => {
              const notes = notesByPara.get(i) ?? [];
              if (para.trim() === "") return <div key={i} className="h-4" />;
              return (
                <div key={i} className="mb-3">
                  <p data-para-index={i} className="text-justify indent-8">
                    {para}
                    {notes.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setOpenNoteId(openNoteId === a.id ? null : a.id!)}
                        className="mx-1 align-super text-sm leading-none"
                        title={a.content}
                      >
                        {a.kind === "complex" ? "📈" : "💡"}
                      </button>
                    ))}
                  </p>
                  {notes.map(
                    (a) =>
                      openNoteId === a.id && (
                        <div
                          key={a.id}
                          className="mt-1 rounded border-l-2 border-amber-400 bg-amber-50 px-3 py-1 text-xs text-gray-600 dark:border-amber-500 dark:bg-amber-900/20 dark:text-gray-300"
                        >
                          「{a.content}」→ {a.result}
                        </div>
                      )
                  )}
                </div>
              );
            })}
          </article>
        </div>

        {/* 底栏：上一章 / 下一章 */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
          <button
            disabled={!hasPrev}
            onClick={() => gotoChapter(currentChapterIndex - 1)}
            className="rounded border border-gray-300 px-4 py-1.5 text-sm disabled:opacity-30 dark:border-gray-600 dark:text-gray-200"
          >
            ← 上一章
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {currentChapterIndex + 1} / {chapterList.length}
          </span>
          <button
            disabled={!hasNext}
            onClick={() => gotoChapter(currentChapterIndex + 1)}
            className="rounded border border-gray-300 px-4 py-1.5 text-sm disabled:opacity-30 dark:border-gray-600 dark:text-gray-200"
          >
            下一章 →
          </button>
        </div>

        {/* 行动面板：纯阅读模式下隐藏 */}
        {!pureReadMode && <ActionPanel />}
      </div>

      {/* 右侧抽屉：目录 / 成长面板 */}
      {sidePanel === "toc" && <TocPanel onClose={() => setSidePanel(null)} />}
      {sidePanel === "character" && <CharacterPanel onClose={() => setSidePanel(null)} />}
    </div>
  );
}
