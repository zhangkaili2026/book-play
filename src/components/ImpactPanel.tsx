"use client";

import { useStore } from "@/lib/store";
import { offsetTier } from "@/lib/actions";
import { isLocalAI } from "@/lib/settings";

const KIND_LABEL = { simple: "简单", medium: "中等", complex: "复杂" } as const;

// 影响面板：偏移度 + 行动影响记录（桌面侧栏 / 移动端全屏）
export default function ImpactPanel({
  onClose,
  focusId,
}: {
  onClose: () => void;
  focusId?: number | null;
}) {
  const offset = useStore((s) => s.offset);
  const recentActions = useStore((s) => s.recentActions);

  return (
    <div className="fixed inset-0 z-30 flex flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:static md:h-full md:w-80 md:shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-gray-100">影响</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="关闭"
        >
          ✕
        </button>
      </div>

      {/* 偏移度 */}
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            📈 主线偏移度 {offset.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{offsetTier(offset)}</span>
        </div>
        <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
          <div
            className="h-2 rounded bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
            style={{ width: `${offset * 100}%` }}
          />
        </div>
      </div>

      {/* 行动影响记录 */}
      <div className="flex-1 overflow-y-auto p-3">
        {recentActions.length ? (
          <div className="space-y-2">
            {recentActions.map((a) => (
              <div
                key={a.id}
                className={`rounded border p-2 text-sm ${
                  a.id === focusId
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/30"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate">「{a.content}」</span>
                  <span className="shrink-0">
                    {KIND_LABEL[a.kind]} · 第{a.chapterIndex + 1}章
                  </span>
                </div>
                {a.cost != null && (
                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {(a.promptTokens ?? 0) + (a.completionTokens ?? 0)} token
                    {a.cached
                      ? " · 缓存命中 0 token"
                      : isLocalAI()
                        ? " · 本地 · 免费"
                        : ` · ¥${a.cost.toFixed(4)}`}
                  </div>
                )}
                <div className="mt-1 text-gray-700 dark:text-gray-200">{a.result}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            还没有行动。做一次行动，影响会记录在这里。
          </p>
        )}
      </div>
    </div>
  );
}
