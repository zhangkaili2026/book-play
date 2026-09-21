"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { classifyAction, offsetTier } from "@/lib/actions";

const KIND_LABEL = { simple: "简单", medium: "中等", complex: "复杂" } as const;

// 行动面板：偏移度显示 + 最近行动结果 + 行动输入框
export default function ActionPanel() {
  const currentPC = useStore((s) => s.currentPC);
  const offset = useStore((s) => s.offset);
  const recentActions = useStore((s) => s.recentActions);
  const selection = useStore((s) => s.selection);
  const submitAction = useStore((s) => s.submitAction);
  const openCreator = useStore((s) => s.openCreator);

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 未开局：提示先开局才能行动
  if (!currentPC) {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        要插入行动影响剧情，需要先{" "}
        <button onClick={openCreator} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          开局
        </button>
        。
      </div>
    );
  }

  // 实时预览行动分级（教学用）
  const kind = text.trim() ? classifyAction(text.trim()) : null;
  const last = recentActions[0];

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    await submitAction(text.trim());
    setText("");
    setSubmitting(false);
  }

  return (
    <div className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* 影响栏：偏移度 + 分级 */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm dark:border-gray-800">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          📈 偏移度 {offset.toFixed(2)}
        </span>
        <span className="text-gray-300 dark:text-gray-600">·</span>
        <span className="text-gray-600 dark:text-gray-400">{offsetTier(offset)}</span>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          已记录 {recentActions.length} 次行动
        </span>
      </div>

      {/* 最近一次行动的结果（引用块样式） */}
      {last && (
        <div className="mx-4 mt-2 rounded-lg border-l-4 border-blue-400 bg-blue-50 px-3 py-2 text-sm dark:border-blue-500 dark:bg-blue-900/30">
          <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            你「{last.content}」
            <span className="text-blue-600 dark:text-blue-400">
              （{KIND_LABEL[last.kind]} · 第{last.chapterIndex + 1}章）
            </span>
            {last.cost != null && (
              <span className="text-gray-400 dark:text-gray-500">
                {" "}
                · {(last.promptTokens ?? 0) + (last.completionTokens ?? 0)} token
                {last.cached ? " · 缓存命中 0 token" : ` · ¥${last.cost.toFixed(4)}`}
              </span>
            )}
          </div>
          <div className="text-gray-700 dark:text-gray-200">{last.result}</div>
        </div>
      )}

      {/* 选区提示 */}
      {selection && (
        <div className="mx-4 mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
          📌 行动将锚定到第 {selection.paraIndex + 1} 段：「{selection.text.slice(0, 20)}
          {selection.text.length > 20 ? "…" : ""}」
        </div>
      )}

      {/* 行动输入框 */}
      <div className="flex items-end gap-2 px-4 py-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={2}
          placeholder="选中正文某段话，再输入行动，可把影响锚定到那里"
          className="flex-1 resize-none rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
        <div className="flex flex-col items-end gap-1">
          {kind && <span className="text-xs text-gray-500 dark:text-gray-400">{KIND_LABEL[kind]}行动</span>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            行动
          </button>
        </div>
      </div>
    </div>
  );
}
