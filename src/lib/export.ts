// ============================================================
// 导出 / 导入：把「我的书游档案」「影响线」「存档备份」变成文件。
// 备份只含"游玩数据"（角色/记忆/行动/偏移度），不含原文 ——
// 换设备时需先重新导入原文 txt，再导入存档。
// ============================================================

import {
  db,
  type Book,
  type Save,
  type Character,
  type NpcMemory,
  type ActionRecord,
  type SystemState,
  type SavePoint,
} from "./db";
import { offsetTier } from "./actions";

// —— 触发浏览器下载 ——
export function download(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); // 挂到 DOM，兼容性更好
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000); // 延迟回收，避免取消下载
}

// —— 导出「我的书游档案」为 Markdown（给人看）——
export function buildArchiveMarkdown(ctx: {
  pc: Character;
  npcMemories: NpcMemory[];
  actions: ActionRecord[];
  offset: number;
  chapterTitle: string;
}): string {
  const { pc, npcMemories, actions, offset, chapterTitle } = ctx;
  const lines: string[] = [];
  lines.push(`# 我的书游档案 · ${pc.name}`);
  lines.push("");
  lines.push(`- 身份：${pc.identity}`);
  lines.push(`- 阵营：${pc.faction}`);
  lines.push(`- 当前章节：${chapterTitle}`);
  lines.push(`- 主线偏移度：${offset.toFixed(2)}（${offsetTier(offset)}）`);
  lines.push("");
  lines.push("## 能力");
  lines.push(`- 固有技能：${pc.abilities.join("、") || "无"}`);
  lines.push(`- 人脉：${pc.connections.join("、") || "无"}`);
  lines.push(`- 势力：${pc.power}`);
  lines.push(`- 资源：${pc.resources.join("、") || "无"}`);
  lines.push("");
  lines.push("## 关系");
  if (npcMemories.length) {
    for (const m of npcMemories) {
      lines.push(`### ${m.npcName}（信任 ${Math.round(m.trust * 100)}%）`);
      lines.push(`- 态度：${m.attitude}`);
      if (m.relationHistory.length) lines.push(`- 关系史：${m.relationHistory.join(" → ")}`);
    }
  } else {
    lines.push("暂无。");
  }
  lines.push("");
  lines.push("## 履历大事");
  const big = actions.filter((a) => a.kind === "complex");
  if (big.length) {
    for (const a of big) lines.push(`- 第${a.chapterIndex + 1}章：「${a.content}」`);
  } else {
    lines.push("暂无。");
  }
  return lines.join("\n");
}

// —— 导出「我的书游记录」（影响线）为 Markdown ——
export function buildInfluenceMarkdown(actions: ActionRecord[], offset: number): string {
  const lines: string[] = [];
  lines.push("# 我的书游记录（影响线）");
  lines.push("");
  lines.push(`最终偏移度：${offset.toFixed(2)}（${offsetTier(offset)}）`);
  lines.push("");
  if (!actions.length) {
    lines.push("暂无行动。");
    return lines.join("\n");
  }
  const kindLabel = { simple: "简单", medium: "中等", complex: "复杂" } as const;
  actions
    .slice()
    .reverse()
    .forEach((a) => {
      lines.push(`## 第${a.chapterIndex + 1}章 · ${kindLabel[a.kind]}行动`);
      lines.push(`> ${a.content}`);
      lines.push("");
      lines.push(a.result);
      lines.push("");
    });
  return lines.join("\n");
}

// —— 存档备份（JSON，用于导入/换设备）——
export interface SaveBackup {
  format: "bookplay-save-backup";
  version: 1;
  exportedAt: number;
  book: { title: string };
  save: Save;
  pc: Character;
  npcMemories: NpcMemory[];
  actions: ActionRecord[];
  systemState?: {
    xp: number;
    level: number;
    points: number;
    redeemed: { name: string; at: number }[];
    messages: string[];
    readChapters: number[];
  };
  savePoints?: SavePoint[];
}

export function buildSaveBackup(ctx: {
  book: Book;
  save: Save;
  pc: Character;
  npcMemories: NpcMemory[];
  actions: ActionRecord[];
  systemState: SystemState;
  savePoints: SavePoint[];
}): SaveBackup {
  return {
    format: "bookplay-save-backup",
    version: 1,
    exportedAt: Date.now(),
    book: { title: ctx.book.title },
    save: ctx.save,
    pc: ctx.pc,
    npcMemories: ctx.npcMemories,
    actions: ctx.actions,
    systemState: {
      xp: ctx.systemState.xp,
      level: ctx.systemState.level,
      points: ctx.systemState.points,
      redeemed: ctx.systemState.redeemed,
      messages: ctx.systemState.messages,
      readChapters: ctx.systemState.readChapters,
    },
    savePoints: ctx.savePoints,
  };
}

// —— 导入存档备份：需先有同名书（原文），再重建游玩数据 ——
export async function importSaveBackup(json: string): Promise<string> {
  let data: SaveBackup;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  if (data?.format !== "bookplay-save-backup" || data?.version !== 1) {
    throw new Error("不是有效的书游存档备份");
  }
  if (!data.save || !data.pc || !data.book?.title) {
    throw new Error("存档备份缺少必要数据");
  }

  const book = await db.books.where("title").equals(data.book.title).first();
  if (!book) {
    throw new Error(`请先导入《${data.book.title}》的原文 txt，再导入这个存档`);
  }

  const saveId = await db.saves.add({
    bookId: book.id!,
    name: `${data.save.name}（导入）`,
    pcId: 0,
    offset: data.save.offset,
    createdAt: Date.now(),
    lastChapterIndex: data.save.lastChapterIndex,
  });

  const pcId = await db.characters.add({
    saveId,
    name: data.pc.name,
    isPC: true,
    identity: data.pc.identity,
    faction: data.pc.faction,
    abilities: data.pc.abilities,
    connections: data.pc.connections,
    power: data.pc.power,
    resources: data.pc.resources,
  });
  await db.saves.update(saveId, { pcId });

  if (data.npcMemories?.length) {
    await db.npcMemories.bulkAdd(
      data.npcMemories.map((m) => ({
        saveId,
        npcName: m.npcName,
        attitude: m.attitude,
        trust: m.trust,
        remembered: m.remembered,
        tendency: m.tendency,
        relationHistory: m.relationHistory,
      }))
    );
  }
  if (data.actions?.length) {
    await db.actions.bulkAdd(
      data.actions.map((a) => ({
        saveId,
        chapterIndex: a.chapterIndex,
        kind: a.kind,
        content: a.content,
        result: a.result,
        createdAt: a.createdAt,
        paraIndex: a.paraIndex,
        ...(a.cost != null
          ? { cost: a.cost, promptTokens: a.promptTokens, completionTokens: a.completionTokens, cached: a.cached }
          : {}),
      }))
    );
  }

  // 恢复系统面板（经验/等级/点数）
  if (data.systemState) {
    await db.systemStates.add({
      saveId,
      xp: data.systemState.xp ?? 0,
      level: data.systemState.level ?? 1,
      points: data.systemState.points ?? 0,
      redeemed: data.systemState.redeemed ?? [],
      messages: data.systemState.messages ?? [],
      readChapters: data.systemState.readChapters ?? [],
    });
  }

  // 恢复存档点
  if (data.savePoints?.length) {
    await db.savePoints.bulkAdd(
      data.savePoints.map((sp) => ({
        saveId,
        name: sp.name,
        isAuto: sp.isAuto,
        createdAt: sp.createdAt,
        chapterIndex: sp.chapterIndex,
        offset: sp.offset,
        xp: sp.xp,
        level: sp.level,
        points: sp.points,
        redeemed: sp.redeemed,
        messages: sp.messages,
        readChapters: sp.readChapters,
        npcMemories: sp.npcMemories,
        actions: sp.actions,
      }))
    );
  }

  return data.book.title;
}
