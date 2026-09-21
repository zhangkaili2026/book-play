"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { offsetTier } from "@/lib/actions";

type Tab = "profile" | "abilities" | "power" | "history" | "relations" | "offset";

const TABS: { key: Tab; label: string }[] = [
  { key: "profile", label: "档案" },
  { key: "abilities", label: "能力" },
  { key: "power", label: "势力" },
  { key: "history", label: "履历" },
  { key: "relations", label: "关系" },
  { key: "offset", label: "偏移" },
];

const KIND_LABEL = { simple: "简单", medium: "中等", complex: "复杂" } as const;

// 成长面板：随当前章节/存档动态更新的侧边栏（桌面侧栏 / 移动端全屏）
export default function CharacterPanel({ onClose }: { onClose: () => void }) {
  const currentPC = useStore((s) => s.currentPC);
  const npcMemories = useStore((s) => s.npcMemories);
  const recentActions = useStore((s) => s.recentActions);
  const offset = useStore((s) => s.offset);
  const chapterList = useStore((s) => s.chapterList);
  const currentChapterIndex = useStore((s) => s.currentChapterIndex);
  const exportArchive = useStore((s) => s.exportArchiveMarkdown);
  const exportInfluence = useStore((s) => s.exportInfluenceMarkdown);
  const exportBackup = useStore((s) => s.exportSaveBackup);
  const [tab, setTab] = useState<Tab>("profile");
  const [menuOpen, setMenuOpen] = useState(false);

  if (!currentPC) return null;

  const chapterTitle = chapterList[currentChapterIndex]?.title ?? "—";
  const bigEvents = recentActions.filter((a) => a.kind === "complex");
  const npcs = [...npcMemories].sort((a, b) => b.trust - a.trust);

  return (
    <div className="fixed inset-0 z-30 flex flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:static md:h-full md:w-80 md:shrink-0">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-gray-100">我的书游档案</span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded px-2 py-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title="导出"
            >
              ⤓ 导出
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 rounded border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => {
                    exportArchive();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  导出档案（Markdown）
                </button>
                <button
                  onClick={() => {
                    exportInfluence();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  导出影响线（Markdown）
                </button>
                <button
                  onClick={() => {
                    exportBackup();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  导出存档备份（JSON）
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            title="关闭"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200 text-xs dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 ${
              tab === t.key
                ? "border-b-2 border-blue-600 font-medium text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
        {tab === "profile" && (
          <div className="space-y-3">
            <Row label="姓名" value={currentPC.name} />
            <Row label="身份" value={currentPC.identity} />
            <Row label="阵营" value={currentPC.faction} />
            <Row label="当前章节" value={chapterTitle} />
            <div>
              <div className="mb-1 text-gray-400 dark:text-gray-500">开局设定</div>
              <div className="rounded bg-gray-50 p-3 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <p>能力：{currentPC.abilities.join("、") || "无"}</p>
                <p>人脉：{currentPC.connections.join("、") || "无"}</p>
                <p>势力：{currentPC.power}</p>
                <p>资源：{currentPC.resources.join("、") || "无"}</p>
              </div>
            </div>
          </div>
        )}

        {tab === "abilities" && (
          <div className="space-y-4">
            <Section title="固有技能" items={currentPC.abilities} />
            <Section title="人脉" items={currentPC.connections} />
            <Section title="资源" items={currentPC.resources} />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              习得技能 / 势力能力将在后续模块随剧情增长叠加。
            </p>
          </div>
        )}

        {tab === "power" && (
          <div className="space-y-3">
            <Row label="势力名称" value={currentPC.power} />
            <div>
              <div className="mb-1 text-gray-400 dark:text-gray-500">掌控资源</div>
              {currentPC.resources.length ? (
                <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                  {currentPC.resources.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">暂无</p>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              规模 / 地盘 / 关键手下将在势力成长模块补齐。
            </p>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">
                大事（颠覆性行动）
              </div>
              {bigEvents.length ? (
                <ul className="space-y-2">
                  {bigEvents.map((a) => (
                    <li
                      key={a.id}
                      className="rounded border-l-2 border-red-400 bg-red-50 px-2 py-1 dark:border-red-500 dark:bg-red-900/30"
                    >
                      <span className="text-gray-700 dark:text-gray-200">「{a.content}」</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {" "}
                        · 第{a.chapterIndex + 1}章
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">
                  暂无。做一件复杂行动就会被记在这里。
                </p>
              )}
            </div>

            <div>
              <div className="mb-2 font-medium text-gray-700 dark:text-gray-300">流水账</div>
              {recentActions.length ? (
                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                  {recentActions.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span className="truncate">{a.content}</span>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        {KIND_LABEL[a.kind]}·第{a.chapterIndex + 1}章
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">暂无行动。</p>
              )}
            </div>
          </div>
        )}

        {tab === "relations" && (
          <div className="space-y-3">
            {npcs.length ? (
              npcs.map((m) => (
                <div
                  key={m.id}
                  className="rounded border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {m.npcName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{m.attitude}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>信任</span>
                    <div className="h-1.5 flex-1 rounded bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-1.5 rounded bg-blue-500"
                        style={{ width: `${Math.round(m.trust * 100)}%` }}
                      />
                    </div>
                    <span>{Math.round(m.trust * 100)}%</span>
                  </div>
                  {m.relationHistory.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      关系史：{m.relationHistory.join(" → ")}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-400 dark:text-gray-500">
                暂无。做一次「结交/试探」类行动，涉及的角色就会出现在这里。
              </p>
            )}
          </div>
        )}

        {tab === "offset" && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {offset.toFixed(2)}
              </div>
              <div className="mt-1 text-gray-600 dark:text-gray-400">{offsetTier(offset)}</div>
            </div>
            <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2 rounded bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
                style={{ width: `${offset * 100}%` }}
              />
            </div>
            <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <li>0 ~ 0.3：自由支线</li>
              <li>0.3 ~ 0.6：明显改变，主线可拉回</li>
              <li>0.6 ~ 0.8：世界开始排斥</li>
              <li>0.8 以上：剧情事件拉回</li>
            </ul>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              简单行动 +0，中等行动 +0.05，复杂行动 +0.2。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-gray-400 dark:text-gray-500">{label}</div>
      <div className="text-gray-800 dark:text-gray-200">{value || "—"}</div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 font-medium text-gray-700 dark:text-gray-300">{title}</div>
      {items.length ? (
        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
          {items.map((x, i) => (
            <li key={i}>· {x}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-400 dark:text-gray-500">无</p>
      )}
    </div>
  );
}
