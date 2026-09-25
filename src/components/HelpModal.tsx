"use client";

// 帮助浮层：快捷键 + 按钮说明 + 玩法提示 + 关于
export default function HelpModal({ onClose }: { onClose: () => void }) {
  const kbd = "rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs font-mono dark:border-gray-600 dark:bg-gray-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">使用帮助</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
            ✕
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">⌨️ 快捷键</div>
            <ul className="space-y-1.5 text-gray-600 dark:text-gray-400">
              <li>
                <span className={kbd}>←</span> / <span className={kbd}>→</span> 翻上一章 / 下一章
              </li>
              <li>
                <span className={kbd}>Esc</span> 退出沉浸模式
              </li>
              <li>
                <span className={kbd}>Enter</span> 提交行动
              </li>
              <li>选中正文文字 → 行动锚定到那里（旁注）</li>
            </ul>
          </div>

          <div>
            <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">🔧 按钮说明</div>
            <ul className="space-y-1.5 text-gray-600 dark:text-gray-400">
              <li>📑 目录 · 📈 影响 · 💾 存档 · 🔍 搜索 · 📊 统计 · 📋 角色</li>
              <li>Aa 阅读设置 · 👁 纯阅读 · 🕶 沉浸 · 🎧 听书 · 🎭 剧本杀</li>
              <li>⚙️ AI 设置（本地 Ollama 免费 / DeepSeek 云服务 / 关闭）</li>
            </ul>
          </div>

          <div>
            <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">💡 玩法提示</div>
            <ul className="space-y-1.5 text-gray-600 dark:text-gray-400">
              <li>简单/中等行动免费（本地规则），复杂行动才调 AI</li>
              <li>选中正文某句话再行动，影响会锚定在那里</li>
              <li>复杂行动会推高「主线偏移度」，太高世界会排斥你</li>
              <li>攒经验升级，点数在「系统」里兑换商城物品</li>
            </ul>
          </div>

          <div className="border-t border-gray-200 pt-3 text-xs text-gray-400 dark:text-gray-500">
            书游引擎 · MIT 开源 ·{" "}
            <a
              href="https://github.com/zhangkaili2026/book-play"
              target="_blank"
              rel="noreferrer"
              className="text-blue-500 hover:underline"
            >
              github.com/zhangkaili2026/book-play
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
