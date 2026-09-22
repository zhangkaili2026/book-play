"use client";

import { useState } from "react";
import { useStore, type NewPC } from "@/lib/store";

// 预设模板：模拟"穿进已有角色"。真正识别原著角色需要 AI，属后期模块；
// 这里先用几个网文常见原型做一键填充。
const TEMPLATES = [
  {
    label: "废柴逆袭",
    identity: "没落世家子弟",
    faction: "无",
    abilities: ["坚韧", "过目不忘"],
    connections: ["家族长辈"],
    power: "无（白手起家）",
    resources: ["祖传功法残卷"],
  },
  {
    label: "世家天才",
    identity: "世家嫡系",
    faction: "世家",
    abilities: ["修炼天赋", "贵族礼仪"],
    connections: ["家主", "族中长老"],
    power: "世家嫡系势力",
    resources: ["家族月例资源", "贴身侍卫"],
  },
  {
    label: "市井白手",
    identity: "市井孤儿",
    faction: "无",
    abilities: ["察言观色", "身手敏捷"],
    connections: ["帮派小头目"],
    power: "无",
    resources: ["几枚铜板"],
  },
];

// 开局角色选择：选模板一键填充，或手动填写，锁定为唯一 PC
export default function CharacterCreator() {
  const createSave = useStore((s) => s.createSave);
  const closeCreator = useStore((s) => s.closeCreator);
  const currentBookId = useStore((s) => s.currentBookId);
  const saves = useStore((s) => s.saves);
  const templates = useStore((s) => s.templates);
  const templatesLoading = useStore((s) => s.templatesLoading);

  const [saveName, setSaveName] = useState(`存档${saves.length + 1}`);
  const [name, setName] = useState("");
  const [identity, setIdentity] = useState("");
  const [faction, setFaction] = useState("");
  const [abilities, setAbilities] = useState("");
  const [connections, setConnections] = useState("");
  const [power, setPower] = useState("");
  const [resources, setResources] = useState("");

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setIdentity(t.identity);
    setFaction(t.faction);
    setAbilities(t.abilities.join("，"));
    setConnections(t.connections.join("，"));
    setPower(t.power);
    setResources(t.resources.join("，"));
  }

  // 逗号/顿号分隔 → 数组
  function splitList(s: string): string[] {
    return s
      .split(/[，,、]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function handleStart() {
    if (!name.trim()) {
      alert("请给角色起个名字");
      return;
    }
    if (currentBookId == null) return;

    const pc: NewPC = {
      name: name.trim(),
      identity: identity.trim() || "未知",
      faction: faction.trim() || "无",
      abilities: splitList(abilities),
      connections: splitList(connections),
      power: power.trim() || "无",
      resources: splitList(resources),
    };
    await createSave(currentBookId, saveName.trim() || `存档${saves.length + 1}`, pc);
  }

  const inputCls =
    "w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-xl px-6 py-8">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100">
          开局 · 选择你的角色
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          选定后锁定为唯一 PC，想换角色只能开新存档。初始能力决定你「能做得到的事」。
        </p>

        {/* 模板快捷填充（AI 生成优先，未接入则用通用模板兜底） */}
        <div className="mb-5">
          {templatesLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">🔍 正在分析书籍类型、生成身份…</p>
          ) : (
            <>
              {templates ? (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  已识别类型：<span className="font-medium">{templates.bookType}</span>
                </p>
              ) : (
                <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">未接入 AI，使用通用模板</p>
              )}
              <div className="flex flex-wrap gap-2">
                {(templates?.items ?? TEMPLATES).map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">存档名</span>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} className={inputCls} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">角色名 *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：萧炎"
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">身份</span>
              <input
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="如：萧家三少爷"
                className={inputCls}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600 dark:text-gray-400">阵营</span>
              <input
                value={faction}
                onChange={(e) => setFaction(e.target.value)}
                placeholder="如：无 / 世家"
                className={inputCls}
              />
            </label>
          </div>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">初始能力（逗号分隔）</span>
            <input
              value={abilities}
              onChange={(e) => setAbilities(e.target.value)}
              placeholder="如：坚韧，过目不忘"
              className={inputCls}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">人脉（逗号分隔）</span>
            <input
              value={connections}
              onChange={(e) => setConnections(e.target.value)}
              placeholder="如：家族长辈"
              className={inputCls}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">势力</span>
            <input
              value={power}
              onChange={(e) => setPower(e.target.value)}
              placeholder="如：无（白手起家）"
              className={inputCls}
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-gray-600 dark:text-gray-400">资源（逗号分隔）</span>
            <input
              value={resources}
              onChange={(e) => setResources(e.target.value)}
              placeholder="如：祖传功法残卷"
              className={inputCls}
            />
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleStart}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              开始游玩
            </button>
            <button
              onClick={closeCreator}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              先纯阅读，暂不开局
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
