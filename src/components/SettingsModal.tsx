"use client";

import { useState } from "react";
import {
  loadSettings,
  saveSettings,
  clearUsage,
  type AISettings,
} from "@/lib/settings";
import { useStore } from "@/lib/store";

// AI 设置弹窗：API Key / 接口 / 模型 / 预算 + 用量统计 + 数据管理
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const refreshUsage = useStore((s) => s.refreshUsage);
  const todayCost = useStore((s) => s.todayCost);
  const totalCost = useStore((s) => s.totalCost);
  const totalTokens = useStore((s) => s.totalTokens);
  const importSave = useStore((s) => s.importSave);
  const clearAllData = useStore((s) => s.clearAllData);
  const clearAICache = useStore((s) => s.clearAICache);
  const cacheCount = useStore((s) => s.cacheCount);

  const [s, setS] = useState<AISettings>(loadSettings());
  const [importMsg, setImportMsg] = useState("");

  function update<K extends keyof AISettings>(key: K, value: AISettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    saveSettings(s);
    refreshUsage();
    onClose();
  }

  const inputCls =
    "w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">AI 设置</h2>

        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">
              API Key（存本地，不上传）
            </span>
            <input
              type="password"
              value={s.apiKey}
              onChange={(e) => update("apiKey", e.target.value)}
              placeholder="sk-...（Ollama 可留空）"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">接口地址 Base URL</span>
            <input value={s.baseUrl} onChange={(e) => update("baseUrl", e.target.value)} className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">模型</span>
            <input value={s.model} onChange={(e) => update("model", e.target.value)} className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">每日预算（元）</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={s.dailyBudget}
              onChange={(e) => update("dailyBudget", Number(e.target.value))}
              className={inputCls}
            />
          </label>

          {/* 用量统计 */}
          <div className="rounded bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <div className="flex justify-between">
              <span>今日费用</span>
              <span>¥{todayCost.toFixed(4)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>累计费用</span>
              <span>¥{totalCost.toFixed(4)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>累计 token</span>
              <span>{totalTokens.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>缓存条数</span>
              <span>{cacheCount}</span>
            </div>
            <div className="mt-2 flex gap-3">
              <button
                onClick={() => {
                  clearUsage();
                  refreshUsage();
                }}
                className="text-red-500 hover:underline"
              >
                清空统计
              </button>
              <button onClick={() => clearAICache()} className="text-red-500 hover:underline">
                清理缓存
              </button>
            </div>
          </div>

          {/* 本地 Ollama 提示 */}
          <div className="rounded bg-blue-50 p-3 text-xs leading-relaxed text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            想用本地 Ollama（免费、无需 Key、无 CORS 问题）：
            Base URL 填 <code>http://localhost:11434/v1</code>，模型填如{" "}
            <code>qwen2.5:7b</code>，API Key 留空。
          </div>

          {/* 数据管理 */}
          <div className="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
            <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">数据管理</div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                导入存档备份（JSON）
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const t = await f.text();
                      const title = await importSave(t);
                      setImportMsg(`已导入《${title}》的存档`);
                    } catch (err) {
                      setImportMsg((err as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                onClick={() => {
                  if (confirm("确定清除所有数据（书、存档、设置、统计）？此操作不可恢复。")) {
                    clearAllData();
                    onClose();
                  }
                }}
                className="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                清除所有数据
              </button>
            </div>
            {importMsg && <p className="mt-2 text-gray-500 dark:text-gray-400">{importMsg}</p>}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
