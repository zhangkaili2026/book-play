"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { classifyAction } from "@/lib/actions";

const KIND_LABEL = { simple: "简单", medium: "中等", complex: "复杂" } as const;

// 行动面板：只放输入框 + 发送按钮 + 选区提示（影响内容在侧边「影响」面板）
export default function ActionPanel() {
  const currentPC = useStore((s) => s.currentPC);
  const selection = useStore((s) => s.selection);
  const submitAction = useStore((s) => s.submitAction);
  const openCreator = useStore((s) => s.openCreator);

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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

  const kind = text.trim() ? classifyAction(text.trim()) : null;

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    await submitAction(text.trim());
    setText("");
    setSubmitting(false);
  }

  // 折叠态：只显示一条可点击的输入条
  if (collapsed) {
    return (
      <div className="border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          💬 输入行动…
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      {/* 选区提示 */}
      {selection && (
        <div className="mx-4 mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
          📌 行动将锚定到第 {selection.paraIndex + 1} 段：「{selection.text.slice(0, 20)}
          {selection.text.length > 20 ? "…" : ""}」
        </div>
      )}

      {/* 行动输入框（可上下拖拽调高度） */}
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
          placeholder="输入你的行动，如：打听萧家的消息 / 结交纳兰嫣然 / 建立自己的势力"
          className="min-h-[2.5rem] max-h-40 flex-1 resize-y rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
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
          <button
            onClick={() => setCollapsed(true)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title="收起输入框"
          >
            ∨ 收起
          </button>
        </div>
      </div>
    </div>
  );
}
