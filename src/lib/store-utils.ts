import { db } from "./db";
import { getOrCreateSystemState } from "./system";
export async function upsertNpcMemory(
  saveId: number,
  name: string,
  kind: "medium" | "complex"
) {
  const existing = await db.npcMemories
    .where("saveId")
    .equals(saveId)
    .and((m) => m.npcName === name)
    .first();

  const trustDelta = kind === "complex" ? 0.1 : 0.05;
  const note = kind === "complex" ? "一次关键接触" : "一次一般接触";

  if (existing) {
    await db.npcMemories.update(existing.id!, {
      trust: Math.min(1, existing.trust + trustDelta),
      remembered: [...existing.remembered, note].slice(-10),
      relationHistory: [...existing.relationHistory, note].slice(-20),
    });
  } else {
    await db.npcMemories.add({
      saveId,
      npcName: name,
      attitude: "陌生",
      trust: trustDelta,
      remembered: [note],
      tendency: "",
      relationHistory: [note],
    });
  }
}

export async function cleanupOrphanData(): Promise<{ removed: number }> {
  return db.transaction("rw", db.tables, async () => {
  const saves = await db.saves.toArray();
  const books = await db.books.toArray();
  const validSaveIds = new Set(saves.map((s) => s.id!));
  const validBookIds = new Set(books.map((b) => b.id!));
  let removed = 0;

  // 1. 孤儿存档（bookId 无效）→ 连同关联数据一起删
  for (const s of saves) {
    if (!validBookIds.has(s.bookId)) {
      await db.characters.where("saveId").equals(s.id!).delete();
      await db.npcMemories.where("saveId").equals(s.id!).delete();
      await db.actions.where("saveId").equals(s.id!).delete();
      await db.systemStates.where("saveId").equals(s.id!).delete();
      await db.savePoints.where("saveId").equals(s.id!).delete();
      await db.highlights.where("saveId").equals(s.id!).delete();
      await db.items.where("saveId").equals(s.id!).delete();
      await db.bookmarks.where("saveId").equals(s.id!).delete();
      await db.saves.delete(s.id!);
      removed++;
    }
  }

  // 2. 孤儿关联数据（saveId 无效）
  const childTables = [
    db.characters,
    db.npcMemories,
    db.actions,
    db.systemStates,
    db.savePoints,
    db.highlights,
    db.bookmarks,
    db.items,
  ] as const;
  for (const table of childTables) {
    const rows = await table.toArray();
    for (const row of rows) {
      if (!validSaveIds.has(row.saveId)) {
        await table.delete(row.id!);
        removed++;
      }
    }
  }

  // 3. 孤儿章节（bookId 无效）
  for (const c of await db.chapters.toArray()) {
    if (!validBookIds.has(c.bookId)) {
      await db.chapters.delete(c.id!);
      removed++;
    }
  }

  return { removed };
  });
}

export async function snapshotCurrentState(saveId: number) {
  return db.transaction("rw", [db.saves, db.systemStates, db.npcMemories, db.actions, db.items, db.characters], async () => {
    const save = await db.saves.get(saveId);
    if (!save) throw new Error("Save no longer exists");
    const sys = await getOrCreateSystemState(saveId);
    const npcMemories = await db.npcMemories.where("saveId").equals(saveId).toArray();
    const actions = await db.actions.where("saveId").equals(saveId).toArray();
    const pc = await db.characters.get(save.pcId);
    const items = await db.items.where("saveId").equals(saveId).toArray();
    return {
      characterState: pc ? {abilities:pc.abilities,resources:pc.resources,connections:pc.connections} : undefined,
      chapterIndex: save?.lastChapterIndex ?? 0,
      offset: save?.offset ?? 0,
      xp: sys.xp,
      level: sys.level,
      points: sys.points,
      redeemed: sys.redeemed,
      messages: sys.messages,
      readChapters: sys.readChapters,
      regrets: sys.regrets ?? [],
      readingSeconds: sys.readingSeconds ?? 0,
      quests: sys.quests ?? [],
      tempAbilities: sys.tempAbilities ?? [],
      npcMemories,
      actions,
      items,
    };
  });
}

export async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("gbk").decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf);
    }
  }
}
