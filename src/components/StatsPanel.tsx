"use client";

import { useEffect, useState } from "react";
import { db, type ActionRecord } from "@/lib/db";
import { useStore } from "@/lib/store";
import { offsetDeltaFor, offsetTier } from "@/lib/actions";

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

  const [allActions, setAllActions] = useState<ActionRecord[]>([]);

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

  // 重构偏移度趋势（按行动累计）
  const trend: number[] = [];
  let cum = 0;
  for (const a of allActions) {
    cum = Math.min(1, cum + offsetDeltaFor(a.kind));
    trend.push(cum);
  }

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
      </div>
    </div>
  );
}
