// ============================================================
// 界面状态（Zustand）：只存"当前在看什么、怎么显示"。
// 正文/存档/角色等数据一律从 IndexedDB 读，不在这里存第二份。
// ============================================================

import { create } from "zustand";
import {
  db,
  type Book,
  type Save,
  type Character,
  type ActionRecord,
  type NpcMemory,
} from "./db";
import { parseChapters } from "./parser";
import {
  classifyAction,
  resolveAction,
  offsetDeltaFor,
  extractTargetName,
} from "./actions";
import { loadSettings, hasAIAccess, getUsage } from "./settings";
import { callLLM, buildActionPrompt } from "./ai";
import { buildCacheKey, getCached, setCached, clearCache, getCacheCount } from "./cache";
import {
  download,
  buildArchiveMarkdown,
  buildInfluenceMarkdown,
  buildSaveBackup,
  importSaveBackup,
} from "./export";

// 章节目录项：只放标题和字数，正文按需去 IndexedDB 取
export interface ChapterMeta {
  index: number;
  title: string;
  charCount: number;
}

// 新建 PC 时，开局界面提交的输入
export interface NewPC {
  name: string;
  identity: string;
  faction: string;
  abilities: string[];
  connections: string[];
  power: string;
  resources: string[];
}

// 更新 NPC 记忆（模块五：结构化存本地，0 token）
async function upsertNpcMemory(
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

interface AppState {
  // —— 书 ——
  books: Book[];
  currentBookId: number | null;
  chapterList: ChapterMeta[];
  currentChapterIndex: number;
  currentContent: string;
  loading: boolean;

  // —— 存档 & 角色 ——
  saves: Save[];
  currentSaveId: number | null;
  currentPC: Character | null;
  showCreator: boolean;

  // —— 影响层 ——
  offset: number;
  recentActions: ActionRecord[];
  npcMemories: NpcMemory[];
  selection: { paraIndex: number; text: string } | null; // 阅读区选中的段落

  // —— AI 消耗 ——
  todayCost: number;
  totalCost: number;
  totalTokens: number;
  cacheCount: number;

  // —— 阅读偏好 ——
  pureReadMode: boolean;
  fontSize: number;
  lineHeight: number;

  // —— 动作 ——
  loadBooks: () => Promise<void>;
  importBook: (file: File) => Promise<void>;
  openBook: (bookId: number) => Promise<void>;
  gotoChapter: (index: number) => Promise<void>;
  switchSave: (saveId: number) => Promise<void>;
  createSave: (bookId: number, saveName: string, pc: NewPC) => Promise<void>;
  deleteSave: (saveId: number) => Promise<void>;
  deleteBook: (bookId: number) => Promise<void>;
  submitAction: (text: string) => Promise<void>;
  refreshUsage: () => Promise<void>;
  clearAICache: () => Promise<void>;
  exportArchiveMarkdown: () => Promise<void>;
  exportInfluenceMarkdown: () => Promise<void>;
  exportSaveBackup: () => Promise<void>;
  importSave: (json: string) => Promise<string>;
  clearAllData: () => Promise<void>;
  openCreator: () => void;
  closeCreator: () => void;
  setSelection: (sel: { paraIndex: number; text: string } | null) => void;
  togglePureRead: () => void;
  setFontSize: (n: number) => void;
  setLineHeight: (n: number) => void;
}

export const useStore = create<AppState>((set, get) => ({
  books: [],
  currentBookId: null,
  chapterList: [],
  currentChapterIndex: 0,
  currentContent: "",
  loading: false,

  saves: [],
  currentSaveId: null,
  currentPC: null,
  showCreator: false,

  offset: 0,
  recentActions: [],
  npcMemories: [],
  selection: null,

  todayCost: 0,
  totalCost: 0,
  totalTokens: 0,
  cacheCount: 0,

  pureReadMode: false,
  fontSize: 18,
  lineHeight: 1.8,

  async loadBooks() {
    const books = await db.books.orderBy("createdAt").reverse().toArray();
    set({ books });
    await get().refreshUsage();
  },

  async importBook(file: File) {
    set({ loading: true });
    try {
      const raw = await file.text();
      const parsed = parseChapters(raw);

      const title = file.name.replace(/\.txt$/i, "");
      const totalChars = parsed.reduce((sum, c) => sum + c.content.length, 0);

      const bookId = await db.books.add({
        title,
        author: "",
        totalChars,
        chapterCount: parsed.length,
        createdAt: Date.now(),
        lastReadIndex: 0,
      });

      await db.chapters.bulkAdd(
        parsed.map((c, i) => ({
          bookId,
          index: i,
          title: c.title,
          content: c.content,
          charCount: c.content.length,
          nodes: [],
          actions: [],
        }))
      );

      await get().loadBooks();
      await get().openBook(bookId);
    } finally {
      set({ loading: false });
    }
  },

  async openBook(bookId: number) {
    const chapters = await db.chapters
      .where("bookId")
      .equals(bookId)
      .sortBy("index");

    const chapterList: ChapterMeta[] = chapters.map((c) => ({
      index: c.index,
      title: c.title,
      charCount: c.charCount,
    }));

    const saves = await db.saves.where("bookId").equals(bookId).sortBy("createdAt");

    set({
      currentBookId: bookId,
      chapterList,
      saves,
      currentSaveId: null,
      currentPC: null,
      showCreator: saves.length === 0,
      offset: 0,
      recentActions: [],
      npcMemories: [],
    });

    if (saves.length > 0) {
      await get().switchSave(saves[saves.length - 1].id!);
    } else {
      await get().gotoChapter(0);
    }
  },

  async gotoChapter(index: number) {
    const { currentBookId, currentSaveId, chapterList } = get();
    if (currentBookId == null || index < 0 || index >= chapterList.length) return;

    const chapter = await db.chapters
      .where("[bookId+index]")
      .equals([currentBookId, index])
      .first();

    if (!chapter) return;
    set({ currentChapterIndex: index, currentContent: chapter.content });

    if (currentSaveId != null) {
      await db.saves.update(currentSaveId, { lastChapterIndex: index });
    } else {
      await db.books.update(currentBookId, { lastReadIndex: index });
    }
  },

  async switchSave(saveId: number) {
    const save = await db.saves.get(saveId);
    if (!save) return;

    const pc = await db.characters
      .where("saveId")
      .equals(saveId)
      .and((c) => c.isPC)
      .first();

    const recent = await db.actions.where("saveId").equals(saveId).toArray();
    recent.sort((a, b) => b.createdAt - a.createdAt);

    const npcMemories = await db.npcMemories.where("saveId").equals(saveId).toArray();

    set({
      currentSaveId: saveId,
      currentPC: pc ?? null,
      showCreator: false,
      offset: save.offset,
      recentActions: recent.slice(0, 20),
      npcMemories,
    });
    await get().gotoChapter(save.lastChapterIndex);
  },

  async createSave(bookId: number, saveName: string, pcInput: NewPC) {
    const saveId = await db.saves.add({
      bookId,
      name: saveName,
      pcId: 0,
      offset: 0,
      createdAt: Date.now(),
      lastChapterIndex: 0,
    });

    const pcId = await db.characters.add({
      saveId,
      name: pcInput.name,
      isPC: true,
      identity: pcInput.identity,
      faction: pcInput.faction,
      abilities: pcInput.abilities,
      connections: pcInput.connections,
      power: pcInput.power,
      resources: pcInput.resources,
    });

    await db.saves.update(saveId, { pcId });

    const saves = await db.saves.where("bookId").equals(bookId).sortBy("createdAt");
    set({ saves });
    await get().switchSave(saveId);
  },

  async deleteSave(saveId: number) {
    const { currentBookId, currentSaveId } = get();

    await db.characters.where("saveId").equals(saveId).delete();
    await db.npcMemories.where("saveId").equals(saveId).delete();
    await db.actions.where("saveId").equals(saveId).delete();
    await db.saves.delete(saveId);

    const saves =
      currentBookId != null
        ? await db.saves.where("bookId").equals(currentBookId).sortBy("createdAt")
        : [];

    if (currentSaveId === saveId) {
      if (saves.length > 0) {
        set({ saves });
        await get().switchSave(saves[saves.length - 1].id!);
      } else {
        set({
          saves,
          currentSaveId: null,
          currentPC: null,
          showCreator: true,
          offset: 0,
          recentActions: [],
          npcMemories: [],
        });
        await get().gotoChapter(0);
      }
    } else {
      set({ saves });
    }
  },

  async deleteBook(bookId: number) {
    const saves = await db.saves.where("bookId").equals(bookId).toArray();
    for (const s of saves) {
      await db.characters.where("saveId").equals(s.id!).delete();
      await db.npcMemories.where("saveId").equals(s.id!).delete();
      await db.actions.where("saveId").equals(s.id!).delete();
    }
    await db.saves.where("bookId").equals(bookId).delete();
    await db.chapters.where("bookId").equals(bookId).delete();
    await db.books.delete(bookId);

    set((s) => ({
      books: s.books.filter((b) => b.id !== bookId),
      currentBookId: s.currentBookId === bookId ? null : s.currentBookId,
    }));
  },

  // 提交一次行动：简单/中等走本地（0 token），复杂走 AI
  async submitAction(text: string) {
    const { currentSaveId, currentPC, currentChapterIndex, chapterList, recentActions, selection } = get();
    if (currentSaveId == null) return;

    const kind = classifyAction(text);

    let result: string;
    let aiPrompt: number | undefined;
    let aiCompletion: number | undefined;
    let aiCost: number | undefined;
    let aiCached: boolean | undefined;

    if (kind === "complex" && currentPC) {
      const usage = getUsage();
      const settings = loadSettings();

      if (!hasAIAccess()) {
        result =
          "这是复杂行动，需要 AI 判断。你还没配置 API Key —— 点右上角 ⚙️ 配置，或用本地 Ollama（免费）。";
      } else if (usage.todayCost >= settings.dailyBudget) {
        result = "今日 AI 预算已用完，自动切回占位结果（本地，0 token）。";
      } else {
        // 先查缓存：相同角色 + 相同章节 + 相同行动 → 直接复用，0 token
        const cacheKey = buildCacheKey(settings.model, currentPC.name, currentChapterIndex, text);
        const cached = await getCached(cacheKey);

        if (cached) {
          result = cached.content;
          aiPrompt = cached.promptTokens;
          aiCompletion = cached.completionTokens;
          aiCost = 0; // 命中缓存：0 新费用
          aiCached = true;
        } else {
          try {
            const messages = buildActionPrompt({
              pc: {
                name: currentPC.name,
                identity: currentPC.identity,
                faction: currentPC.faction,
                abilities: currentPC.abilities,
                power: currentPC.power,
                resources: currentPC.resources,
              },
              chapterTitle: chapterList[currentChapterIndex]?.title ?? "",
              recentActions: recentActions.slice(0, 5).map((a) => a.content),
              action: text,
            });
            const ai = await callLLM(messages);
            await setCached(cacheKey, ai);
            result = ai.content;
            aiPrompt = ai.promptTokens;
            aiCompletion = ai.completionTokens;
            aiCost = ai.cost;
            aiCached = false;
          } catch (e) {
            result = `AI 调用失败：${(e as Error).message}`;
          }
        }
      }
    } else {
      result = resolveAction(text, kind, currentPC?.name ?? "你");
    }

    await db.actions.add({
      saveId: currentSaveId,
      chapterIndex: currentChapterIndex,
      kind,
      content: text,
      result,
      createdAt: Date.now(),
      paraIndex: selection?.paraIndex,
      ...(aiCost != null
        ? { cost: aiCost, promptTokens: aiPrompt, completionTokens: aiCompletion, cached: aiCached }
        : {}),
    });

    // 更新偏移度（封顶 1）
    const save = await db.saves.get(currentSaveId);
    const newOffset = Math.min(1, (save?.offset ?? 0) + offsetDeltaFor(kind));
    await db.saves.update(currentSaveId, { offset: newOffset });

    // 中等/复杂行动 → 尝试更新 NPC 记忆
    if (kind !== "simple") {
      const target = extractTargetName(text);
      if (target && target !== currentPC?.name) {
        await upsertNpcMemory(currentSaveId, target, kind);
      }
    }

    const recent = await db.actions.where("saveId").equals(currentSaveId).toArray();
    recent.sort((a, b) => b.createdAt - a.createdAt);
    const npcMemories = await db.npcMemories.where("saveId").equals(currentSaveId).toArray();

    const u = getUsage();
    set({
      offset: newOffset,
      recentActions: recent.slice(0, 20),
      npcMemories,
      todayCost: u.todayCost,
      totalCost: u.totalCost,
      totalTokens: u.totalPrompt + u.totalCompletion,
      selection: null, // 行动已锚定，清除选区
    });
  },

  async refreshUsage() {
    const u = getUsage();
    const cacheCount = await getCacheCount();
    set({
      todayCost: u.todayCost,
      totalCost: u.totalCost,
      totalTokens: u.totalPrompt + u.totalCompletion,
      cacheCount,
    });
  },

  async clearAICache() {
    await clearCache();
    set({ cacheCount: 0 });
  },

  async exportArchiveMarkdown() {
    const { currentPC, npcMemories, currentSaveId, chapterList, currentChapterIndex } = get();
    if (!currentPC) return;
    const actions =
      currentSaveId != null
        ? await db.actions.where("saveId").equals(currentSaveId).toArray()
        : [];
    const save = currentSaveId != null ? await db.saves.get(currentSaveId) : undefined;
    const md = buildArchiveMarkdown({
      pc: currentPC,
      npcMemories,
      actions,
      offset: save?.offset ?? 0,
      chapterTitle: chapterList[currentChapterIndex]?.title ?? "",
    });
    download(`我的书游档案_${currentPC.name}.md`, md);
  },

  async exportInfluenceMarkdown() {
    const { currentSaveId } = get();
    if (currentSaveId == null) return;
    const actions = await db.actions.where("saveId").equals(currentSaveId).toArray();
    const save = await db.saves.get(currentSaveId);
    const md = buildInfluenceMarkdown(actions, save?.offset ?? 0);
    download("我的书游记录.md", md);
  },

  async exportSaveBackup() {
    const { currentSaveId } = get();
    if (currentSaveId == null) return;
    const save = await db.saves.get(currentSaveId);
    if (!save) return;
    const pc = await db.characters.get(save.pcId);
    const npcMemories = await db.npcMemories.where("saveId").equals(currentSaveId).toArray();
    const actions = await db.actions.where("saveId").equals(currentSaveId).toArray();
    const book = await db.books.get(save.bookId);
    if (!pc || !book) return;
    const backup = buildSaveBackup({ book, save, pc, npcMemories, actions });
    download(`书游存档_${save.name}.json`, JSON.stringify(backup, null, 2), "application/json");
  },

  async importSave(json: string) {
    const title = await importSaveBackup(json);
    await get().loadBooks();
    const book = await db.books.where("title").equals(title).first();
    if (book) await get().openBook(book.id!);
    return title;
  },

  async clearAllData() {
    await Promise.all([
      db.books.clear(),
      db.chapters.clear(),
      db.saves.clear(),
      db.characters.clear(),
      db.npcMemories.clear(),
      db.actions.clear(),
    ]);
    localStorage.clear();
    set({
      books: [],
      currentBookId: null,
      chapterList: [],
      currentChapterIndex: 0,
      currentContent: "",
      saves: [],
      currentSaveId: null,
      currentPC: null,
      showCreator: false,
      offset: 0,
      recentActions: [],
      npcMemories: [],
      todayCost: 0,
      totalCost: 0,
      totalTokens: 0,
    });
  },

  setSelection(sel) {
    set({ selection: sel });
  },

  openCreator() {
    set({ showCreator: true });
  },
  closeCreator() {
    set({ showCreator: false });
  },
  togglePureRead() {
    set((s) => ({ pureReadMode: !s.pureReadMode }));
  },
  setFontSize(n) {
    set({ fontSize: n });
  },
  setLineHeight(n) {
    set({ lineHeight: n });
  },
}));
