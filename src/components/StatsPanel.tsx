"use client";

import { useEffect, useState } from "react";
import { db, type ActionRecord } from "@/lib/db";
import { useStore } from "@/lib/store";
import { offsetDeltaFor, offsetTier, getEnding } from "@/lib/actions";
import { download } from "@/lib/export";
import { generateShareCard, type ShareTheme } from "@/lib/shareCard";
import { getTodayReadingSeconds, getReadingGoalMinutes, getReadingStreak, getLastNDays, recordEnding, getReachedEndings } from "@/lib/settings";
import { ACHIEVEMENTS, checkAchievements } from "@/lib/achievements";

function formatSeconds(s: number): string {
  if (s < 60) return `${s}秒`;
  if (s < 3600) return `${Math.floor(s / 60)}分钟`;
  return `${Math.floor(s / 3600)}小时${Math.floor((s % 3600) / 60)}分`;
}

function buildStoryMarkdown(actions: ActionRecord[], pcName: string): string {
  const sorted = [...actions].sort((a, b) => a.createdAt - b.createdAt);
  const lines = [`# 我在这本书里的故事 · ${pcName}`, ""];
  for (const a of sorted) {
    lines.push(`### 第${a.chapterIndex + 1}章 · ${a.content}`);
    lines.push("");
    lines.push(a.result);
    lines.push("");
  }
  return lines.join("\n");
}

// 偏移度趋势曲线（单色折线 + 分级参考线，纯 SVG 无依赖）
function OffsetSparkline({ trend }: { trend: number[] }) {
  const w = 300;
  const h = 90;
  const pad = 10;
  const n = trend.length;

  if (n === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500">还没有行动，曲线为空。</p>;
  }

  const x = (i: number) => pad + (n === 1 ? 0 : (i / (n - 1)) * (w - pad * 2));
  const y = (v: number) => h - pad - v * (h - pad * 2);

  const points = trend.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const lastX = x(n - 1);
  const lastY = y(trend[n - 1]);
  const tiers = [0.3, 0.6, 0.8];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="主线偏移度趋势">
      {tiers.map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={y(t)}
          y2={y(t)}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeDasharray="3 3"
        />
      ))}
      <polyline
        points={points}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill="#3b82f6" />
    </svg>
  );
}

// 统计面板：阅读数据 + 偏移度趋势
export default function StatsPanel({ onClose }: { onClose: () => void }) {
  const currentSaveId = useStore((s) => s.currentSaveId);
  const chapterList = useStore((s) => s.chapterList);
  const currentChapterIndex = useStore((s) => s.currentChapterIndex);
  const offset = useStore((s) => s.offset);
  const npcMemories = useStore((s) => s.npcMemories);
  const systemState = useStore((s) => s.systemState);
  const books = useStore((s) => s.books);
  const currentBookId = useStore((s) => s.currentBookId);
  const currentPC = useStore((s) => s.currentPC);

  const [allActions, setAllActions] = useState<ActionRecord[]>([]);
  const [shareTheme, setShareTheme] = useState<ShareTheme>("默认");
  const [reachedEndings, setReachedEndings] = useState<string[]>(() => getReachedEndings());

  useEffect(() => {
    if (currentSaveId == null) {
      setAllActions([]);
      return;
    }
    db.actions
      .where("saveId")
      .equals(currentSaveId)
      .toArray()
      .then((arr) => {
        arr.sort((a, b) => a.createdAt - b.createdAt);
        setAllActions(arr);
      });
  }, [currentSaveId]);

  // 在用户"导出报告/分享卡片"时记录当前结局到图鉴（打开面板不自动解锁）
  function recordEndingNow() {
    recordEnding(getEnding(offset).label);
    setReachedEndings(getReachedEndings());
  }

  const unlocked = checkAchievements({
    offset,
    complexCount: allActions.filter((a) => a.kind === "complex").length,
    readCount: systemState?.readChapters?.length ?? 0,
    npcCount: npcMemories.length,
    redeemedCount: (systemState?.redeemed ?? []).length,
  });
  const allEndings = ["原著结局", "改变结局", "颠覆结局", "世界反噬"];

  // 重构偏移度趋势（按行动累计）
  const trend: number[] = [];
  let cum = 0;
  for (const a of allActions) {
    cum = Math.min(1, cum + offsetDeltaFor(a.kind));
    trend.push(cum);
  }

  const ending = getEnding(offset);
  const complexActions = allActions.filter((a) => a.kind === "complex");
  const bookTitle = books.find((b) => b.id === currentBookId)?.title ?? "未命名";
  const pcName = currentPC?.name ?? "我";
  const todaySeconds = getTodayReadingSeconds();
  const goalMinutes = getReadingGoalMinutes();
  const goalSeconds = goalMinutes * 60;
  const goalPercent = goalSeconds > 0 ? Math.min(100, (todaySeconds / goalSeconds) * 100) : 0;
  const goalMet = goalSeconds > 0 && todaySeconds >= goalSeconds;
  const streak = getReadingStreak();
  const last7 = getLastNDays(7);
  const maxDaySeconds = Math.max(...last7.map((d) => d.seconds), 1);
  const reportMd = [
    "# 我的书游报告",
    "",
    `- 结局：${ending.label}`,
    `- 章节进度：${currentChapterIndex + 1} / ${chapterList.length}`,
    `- 行动次数：${allActions.length}（复杂 ${complexActions.length} 次）`,
    `- 主线偏移度：${offset.toFixed(2)}（${offsetTier(offset)}）`,
    `- 关系角色：${npcMemories.length}`,
    `- 等级：Lv.${systemState?.level ?? 1} · 点数 ${systemState?.points ?? 0}`,
    `- 意难平：${(systemState?.regrets ?? []).length} 条`,
    "",
    "## 大事记",
    ...(complexActions.length
      ? complexActions.map((a) => `- 第${a.chapterIndex + 1}章「${a.content}」`)
      : ["- 暂无复杂行动"]),
    "",
    `> ${ending.desc}`,
  ].join("\n");

  const stat = (label: string, value: string) => (
    <div className="rounded border border-gray-200 p-2 text-center dark:border-gray-700">
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-xs text-gray-400 dark:text-gray-500">{label}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 md:static md:h-full md:w-80 md:shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <span className="font-bold text-gray-900 dark:text-gray-100">统计</span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title="关闭"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* 关键数字 */}
        <div className="grid grid-cols-2 gap-2">
          {stat("章节进度", `${currentChapterIndex + 1}/${chapterList.length}`)}
          {stat("行动次数", `${allActions.length}`)}
          {stat("关系角色", `${npcMemories.length}`)}
          {stat("等级", `Lv.${systemState?.level ?? 1}`)}
          {stat("系统点数", `${systemState?.points ?? 0}`)}
          {stat("偏移度", offset.toFixed(2))}
          {stat("阅读时长", formatSeconds(systemState?.readingSeconds ?? 0))}
        </div>

        {/* 今日阅读目标 */}
        <div className="mt-4 rounded border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              今日阅读
              {streak > 0 && <span className="ml-1 text-xs text-orange-500">🔥 连续 {streak} 天</span>}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatSeconds(todaySeconds)} / 目标 {goalMinutes} 分钟{goalMet ? " ✅ 已达标" : ""}
            </span>
          </div>
          <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded bg-green-500"
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>

        {/* 本周阅读柱状图 */}
        <div className="mt-3 rounded border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">本周阅读（分钟）</div>
          <div className="flex h-12 items-end gap-1">
            {last7.map((d, i) => {
              const h = (d.seconds / maxDaySeconds) * 48;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-blue-400 dark:bg-blue-500"
                  style={{ height: `${Math.max(2, h)}px` }}
                  title={`${d.date.slice(5)}: ${Math.round(d.seconds / 60)} 分钟`}
                />
              );
            })}
          </div>
        </div>

        {/* 偏移度趋势 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              主线偏移度趋势
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{offsetTier(offset)}</span>
          </div>
          <div className="text-gray-400 dark:text-gray-500">
            <OffsetSparkline trend={trend} />
          </div>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            虚线为分级线（0.3 / 0.6 / 0.8）。越往上世界越排斥你。
          </p>
        </div>

        {/* 时间线 + 回放 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">时间线</span>
            <button
              onClick={() => download("我的故事.md", buildStoryMarkdown(allActions, pcName))}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              回放导出
            </button>
          </div>
          {allActions.length ? (
            <div className="space-y-1">
              {allActions.map((a) => (
                <div key={a.id} className="border-l-2 border-gray-200 pl-2 dark:border-gray-700">
                  <div className="text-xs text-gray-400 dark:text-gray-500">第{a.chapterIndex + 1}章</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">{a.content}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">还没有行动。</p>
          )}
        </div>

        {/* 结局 + 玩后报告 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">结局与报告</span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  recordEndingNow();
                  generateShareCard({
                    pcName,
                    bookTitle,
                    ending,
                    offset,
                    offsetTier: offsetTier(offset),
                    actionCount: allActions.length,
                    complexCount: complexActions.length,
                    npcCount: npcMemories.length,
                    level: systemState?.level ?? 1,
                    complexActions,
                  }, shareTheme);
                }}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                分享卡片
              </button>
              <button
                onClick={() => {
                  recordEndingNow();
                  download("我的书游报告.md", reportMd);
                }}
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                导出报告
              </button>
            </div>
          </div>

          <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
            <div className="mb-1 font-medium text-gray-900 dark:text-gray-100">🎬 {ending.label}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{ending.desc}</p>
          </div>

          <div className="mt-2 flex items-center gap-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">卡片主题</span>
            {(["默认", "修仙风", "权谋风", "暗黑风"] as ShareTheme[]).map((th) => (
              <button
                key={th}
                onClick={() => setShareTheme(th)}
                className={`rounded px-2 py-0.5 text-xs ${
                  shareTheme === th
                    ? "bg-blue-100 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {th}
              </button>
            ))}
          </div>

          <pre className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs leading-relaxed text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {reportMd}
          </pre>
        </div>

        {/* 结局图鉴 + 成就 */}
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              结局图鉴（{reachedEndings.length}/{allEndings.length}）
            </div>
            <div className="grid grid-cols-2 gap-2">
              {allEndings.map((e) => (
                <div
                  key={e}
                  className={`rounded border p-2 text-center text-xs ${
                    reachedEndings.includes(e)
                      ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
                      : "border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500"
                  }`}
                >
                  {reachedEndings.includes(e) ? "✅" : "🔒"} {e}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              成就（{unlocked.size}/{ACHIEVEMENTS.length}）
            </div>
            <div className="space-y-1">
              {ACHIEVEMENTS.map((a) => {
                const got = unlocked.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                      got
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    <span>{got ? "✅" : "🔒"} {a.name}</span>
                    <span className="text-gray-400 dark:text-gray-500">{a.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
