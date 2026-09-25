"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, type FontChoice, type ReadingBgChoice } from "@/lib/store";
import ActionPanel from "@/components/ActionPanel";
import CharacterPanel from "@/components/CharacterPanel";
import TocPanel from "@/components/TocPanel";
import ImpactPanel from "@/components/ImpactPanel";
import SavePanel from "@/components/SavePanel";
import SearchPanel from "@/components/SearchPanel";
import StatsPanel from "@/components/StatsPanel";
import TTSBar from "@/components/TTSBar";
import { getScrollPos, setScrollPos } from "@/lib/scroll";
import { db, type ActionRecord } from "@/lib/db";
import { FAMOUS_SCENE_KEYWORDS } from "@/lib/system";

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
  const currentBookId = useStore((s) => s.currentBookId);
  const pureReadMode = useStore((s) => s.pureReadMode);
  const recentActions = useStore((s) => s.recentActions);
  const systemState = useStore((s) => s.systemState);
  const highlights = useStore((s) => s.highlights);
  const gotoChapter = useStore((s) => s.gotoChapter);
  const switchSave = useStore((s) => s.switchSave);
  const openCreator = useStore((s) => s.openCreator);
  const setFontSize = useStore((s) => s.setFontSize);
  const setLineHeight = useStore((s) => s.setLineHeight);
  const setFontFamily = useStore((s) => s.setFontFamily);
  const setReadingBg = useStore((s) => s.setReadingBg);
  const togglePureRead = useStore((s) => s.togglePureRead);
  const setSelection = useStore((s) => s.setSelection);

  const [sidePanel, setSidePanel] = useState<
    "toc" | "character" | "impact" | "save" | "search" | "stats" | null
  >(null);
  const [aaOpen, setAaOpen] = useState(false);
  const [focusActionId, setFocusActionId] = useState<number | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [echoes, setEchoes] = useState<ActionRecord[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scrollKey(index: number) {
    return `${currentSaveId ?? "book" + currentBookId}:${index}`;
  }

  // 滚动时记录位置（节流 150ms）
  function handleScroll() {
    const el = scrollRef.current;
    if (!el || saveTimer.current) return;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      setScrollPos(scrollKey(currentChapterIndex), el.scrollTop);
    }, 150);
  }

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

  // 本章划线 → 按段落分组
  const chapterHighlights = highlights.filter((h) => h.chapterIndex === currentChapterIndex);
  const highlightByPara = new Map<number, typeof chapterHighlights>();
  for (const h of chapterHighlights) {
    const list = highlightByPara.get(h.paraIndex) ?? [];
    list.push(h);
    highlightByPara.set(h.paraIndex, list);
  }

  // 名场面 + 意难平
  const famousScene = FAMOUS_SCENE_KEYWORDS.some((k) => currentContent.includes(k));
  const regrets = systemState?.regrets ?? [];
  // 全书进度（0-100）
  const progress = chapterList.length > 0 ? ((currentChapterIndex + 1) / chapterList.length) * 100 : 0;

  // 翻章后恢复到该章上次读到的位置（没记录则回到顶部）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const key = `${currentSaveId ?? "book" + currentBookId}:${currentChapterIndex}`;
    el.scrollTop = getScrollPos(key);
  }, [currentChapterIndex, currentSaveId, currentBookId]);

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

  // Esc 退出沉浸模式
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setImmersive(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 阅读时长统计：每 60 秒累加一次
  useEffect(() => {
    if (currentSaveId == null) return;
    const timer = setInterval(() => {
      useStore.getState().addReadingSeconds(60);
    }, 60000);
    return () => clearInterval(timer);
  }, [currentSaveId]);

  // 影响回响：早期复杂行动在后续章节的"回音"（本地，0 token）
  useEffect(() => {
    if (currentSaveId == null) {
      setEchoes([]);
      return;
    }
    db.actions
      .where("saveId")
      .equals(currentSaveId)
      .toArray()
      .then((arr) => {
        const past = arr
          .filter((a) => a.kind === "complex" && a.chapterIndex < currentChapterIndex)
          .sort((a, b) => b.chapterIndex - a.chapterIndex)
          .slice(0, 3);
        setEchoes(past);
      });
  }, [currentSaveId, currentChapterIndex]);

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

  // 正文区（沉浸模式全屏，普通模式 flex-1）
  const readingArea = (
    <div
      ref={scrollRef}
      className={`reading-scroll overflow-y-auto ${immersive ? "h-full" : "flex-1"}`}
      style={{ backgroundColor: bgStyle.bg, color: bgStyle.text }}
      onScroll={handleScroll}
    >
      {/* 全书进度条（细、吸顶） */}
      <div className="sticky top-0 z-10 h-0.5 w-full bg-gray-200/60 dark:bg-gray-700/60">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <article
        key={currentChapterIndex}
        className="animate-fade-in mx-auto max-w-2xl px-6 py-10"
        style={{ fontSize: `${fontSize}px`, lineHeight, fontFamily: FONT_STACKS[fontFamily] }}
      >
        {(famousScene || echoes.length > 0 || regrets.length > 0) && (
          <div className="mb-6 space-y-2">
            {famousScene && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                🎯 名场面：此处有重要剧情，选中文字可插入行动干预。
              </div>
            )}
            {echoes.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                <div className="mb-1 font-medium">📌 回响</div>
                {echoes.map((e) => (
                  <div key={e.id} className="leading-relaxed">
                    第{e.chapterIndex + 1}章「{e.content}」的影响，仍在延续。
                  </div>
                ))}
              </div>
            )}
            {regrets.length > 0 && (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-2 text-xs text-purple-800 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-200">
                <div className="mb-1 font-medium">🎯 我的意难平</div>
                {regrets.map((r, i) => (
                  <div key={i} className="leading-relaxed">
                    · {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <h1 className="mb-8 text-center text-2xl font-bold">{chapter?.title}</h1>
        {paragraphs.map((para, i) => {
          const notes = notesByPara.get(i) ?? [];
          const hls = highlightByPara.get(i) ?? [];
          if (para.trim() === "") return <div key={i} className="h-4" />;
          return (
            <div key={i} className="mb-3">
              <p
                data-para-index={i}
                className={`text-justify indent-8 ${
                  hls.length ? "rounded bg-yellow-100 dark:bg-yellow-900/30" : ""
                }`}
              >
                {para}
                {notes.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setFocusActionId(a.id!);
                      setSidePanel("impact");
                    }}
                    className="mx-1 align-super text-sm leading-none"
                    title={a.content}
                  >
                    {a.kind === "complex" ? "📈" : "💡"}
                  </button>
                ))}
                {hls.length > 0 && (
                  <span
                    className="ml-1 align-super text-xs"
                    title={hls.map((h) => h.text).join("；")}
                  >
                    🖍️
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </article>
    </div>
  );

  // 沉浸模式：只显示正文 + 退出按钮
  if (immersive) {
    return (
      <div className="relative h-full">
        {readingArea}
        <button
          onClick={() => setImmersive(false)}
          className="fixed right-4 top-4 z-40 rounded-full border border-gray-300 bg-white/80 px-3 py-1 text-sm text-gray-600 shadow-sm hover:bg-white dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300"
          title="退出沉浸模式（Esc）"
        >
          ✕ 退出沉浸
        </button>
      </div>
    );
  }

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
          <button
            onClick={() => {
              setFocusActionId(null);
              setSidePanel(sidePanel === "impact" ? null : "impact");
            }}
            className={btnCls + " text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}
            title="影响"
          >
            📈 影响
          </button>
          <button
            onClick={() => setSidePanel(sidePanel === "save" ? null : "save")}
            className={btnCls + " text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}
            title="存档"
          >
            💾 存档
          </button>
          <button
            onClick={() => setSidePanel(sidePanel === "search" ? null : "search")}
            className={btnCls + " text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}
            title="搜索"
          >
            🔍 搜索
          </button>
          <button
            onClick={() => setSidePanel(sidePanel === "stats" ? null : "stats")}
            className={btnCls + " text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"}
            title="统计"
          >
            📊 统计
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
            <button
              onClick={() => setImmersive(true)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              title="沉浸模式（只留正文，Esc 退出）"
            >
              🕶 沉浸
            </button>
          </div>
        </div>

        {/* 正文区（可滚动，含旁注图标） */}
        {readingArea}

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

        {/* 听书栏 */}
        <TTSBar />

        {/* 行动面板：纯阅读模式下隐藏 */}
        {!pureReadMode && <ActionPanel />}
      </div>

      {/* 右侧抽屉：目录 / 影响 / 成长面板 */}
      {sidePanel === "toc" && <TocPanel onClose={() => setSidePanel(null)} />}
      {sidePanel === "impact" && (
        <ImpactPanel onClose={() => setSidePanel(null)} focusId={focusActionId} />
      )}
      {sidePanel === "save" && <SavePanel onClose={() => setSidePanel(null)} />}
      {sidePanel === "search" && <SearchPanel onClose={() => setSidePanel(null)} />}
      {sidePanel === "stats" && <StatsPanel onClose={() => setSidePanel(null)} />}
      {sidePanel === "character" && <CharacterPanel onClose={() => setSidePanel(null)} />}
    </div>
  );
}
