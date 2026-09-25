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
  type SystemState,
  type BookTemplateItem,
  type SavePoint,
} from "./db";
import { parseChapters } from "./parser";
import {
  classifyAction,
  resolveAction,
  offsetDeltaFor,
  extractTargetName,
} from "./actions";
import { loadSettings, hasAIAccess, getUsage } from "./settings";
import { callLLM, buildActionPrompt, generateBookTemplates } from "./ai";
import { buildCacheKey, getCached, setCached, clearCache, getCacheCount } from "./cache";
import { XP_RULES, DEFAULT_SHOP, getShopItems, XP_PER_LEVEL, POINTS_PER_LEVEL, type ShopItem } from "./system";
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

// 阅读字体 / 背景色选项
export type FontChoice = "serif" | "sans" | "kai";
export type ReadingBgChoice = "paper" | "white" | "green" | "dark";

// 读取文本文件：自动识别编码（UTF-8 优先，失败回退 GBK——中文小说常见）
async function readTextFile(file: File): Promise<string> {
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

// 阅读偏好持久化（字号/行距/字体/背景，存 localStorage，刷新不丢）
const READING_PREFS_KEY = "bookplay.readingPrefs";

function loadReadingPrefs(): {
  fontSize: number;
  lineHeight: number;
  fontFamily: FontChoice;
  readingBg: ReadingBgChoice;
} {
  const defaults = {
    fontSize: 18,
    lineHeight: 1.8,
    fontFamily: "serif" as FontChoice,
    readingBg: "paper" as ReadingBgChoice,
  };
  try {
    const raw = localStorage.getItem(READING_PREFS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

function saveReadingPrefs(patch: Partial<ReturnType<typeof loadReadingPrefs>>): void {
  try {
    localStorage.setItem(READING_PREFS_KEY, JSON.stringify({ ...loadReadingPrefs(), ...patch }));
  } catch {
    /* ignore */
  }
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

// 读取（或懒创建）某存档的系统状态
async function getOrCreateSystemState(saveId: number): Promise<SystemState> {
  let sys = await db.systemStates.where("saveId").equals(saveId).first();
  if (!sys) {
    const id = await db.systemStates.add({
      saveId,
      xp: 0,
      level: 1,
      points: 0,
      redeemed: [],
      messages: ["系统已激活"],
      readChapters: [],
      regrets: [],
      readingSeconds: 0,
    });
    sys = (await db.systemStates.get(id))!;
  }
  return sys;
}

// 发放经验：计算升级/点数，写回库，返回更新后的状态
async function grantXp(
  saveId: number,
  amount: number,
  reason: string,
  markChapterRead?: number
): Promise<SystemState> {
  const sys = await getOrCreateSystemState(saveId);
  const xp = sys.xp + amount;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const levelUps = level - sys.level;
  const points = sys.points + levelUps * POINTS_PER_LEVEL;

  const messages = [...sys.messages, `+${amount} 经验（${reason}）`];
  if (levelUps > 0) {
    messages.push(`🎉 升级到 ${level} 级，获得 ${levelUps * POINTS_PER_LEVEL} 点数`);
  }

  const readChapters =
    markChapterRead != null && !sys.readChapters.includes(markChapterRead)
      ? [...sys.readChapters, markChapterRead]
      : sys.readChapters;

  const next: SystemState = {
    ...sys,
    xp,
    level,
    points,
    messages: messages.slice(-20),
    readChapters,
  };
  await db.systemStates.update(sys.id!, {
    xp,
    level,
    points,
    messages: next.messages,
    readChapters,
  });
  return next;
}

// 清理孤儿数据：删除「父记录已不存在」的子记录（历史遗留的垃圾）
async function cleanupOrphanData(): Promise<{ removed: number }> {
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
}

// 快照当前游戏状态（用于存档点）
async function snapshotCurrentState(saveId: number) {
  const save = await db.saves.get(saveId);
  const sys = await getOrCreateSystemState(saveId);
  const npcMemories = await db.npcMemories.where("saveId").equals(saveId).toArray();
  const actions = await db.actions.where("saveId").equals(saveId).toArray();
  return {
    chapterIndex: save?.lastChapterIndex ?? 0,
    offset: save?.offset ?? 0,
    xp: sys.xp,
    level: sys.level,
    points: sys.points,
    redeemed: sys.redeemed,
    messages: sys.messages,
    readChapters: sys.readChapters,
    npcMemories,
    actions,
  };
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
  systemState: SystemState | null; // 当前存档的系统面板状态
  templates: { bookType: string; items: BookTemplateItem[] } | null; // 当前书 AI 生成的开局身份
  templatesLoading: boolean;
  savePoints: SavePoint[]; // 当前存档的存档点列表
  shopItems: ShopItem[]; // 当前书的商城兑换项（按书籍类型生成）

  // —— AI 消耗 ——
  todayCost: number;
  totalCost: number;
  totalTokens: number;
  cacheCount: number;

  // —— 阅读偏好 ——
  pureReadMode: boolean;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontChoice;
  readingBg: ReadingBgChoice;

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
  runCleanup: () => Promise<number>;
  exportArchiveMarkdown: () => Promise<void>;
  exportInfluenceMarkdown: () => Promise<void>;
  exportSaveBackup: () => Promise<void>;
  importSave: (json: string) => Promise<string>;
  clearAllData: () => Promise<void>;
  redeem: (itemId: string) => Promise<void>;
  addRegret: (text: string) => Promise<void>;
  removeRegret: (index: number) => Promise<void>;
  addReadingSeconds: (n: number) => Promise<void>;
  refreshSavePoints: () => Promise<void>;
  createSavePoint: (name: string) => Promise<void>;
  autoSavePoint: () => Promise<void>;
  restoreSavePoint: (id: number) => Promise<void>;
  deleteSavePoint: (id: number) => Promise<void>;
  openCreator: () => void;
  closeCreator: () => void;
  setSelection: (sel: { paraIndex: number; text: string } | null) => void;
  togglePureRead: () => void;
  setFontSize: (n: number) => void;
  setLineHeight: (n: number) => void;
  setFontFamily: (f: FontChoice) => void;
  setReadingBg: (b: ReadingBgChoice) => void;
}

const readingPrefs = loadReadingPrefs();

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
  systemState: null,
  templates: null,
  templatesLoading: false,
  savePoints: [],
  shopItems: DEFAULT_SHOP,

  todayCost: 0,
  totalCost: 0,
  totalTokens: 0,
  cacheCount: 0,

  pureReadMode: false,
  fontSize: readingPrefs.fontSize,
  lineHeight: readingPrefs.lineHeight,
  fontFamily: readingPrefs.fontFamily,
  readingBg: readingPrefs.readingBg,

  async loadBooks() {
    const books = await db.books.orderBy("createdAt").reverse().toArray();
    set({ books });
    await get().refreshUsage();
    await cleanupOrphanData(); // 静默清理历史遗留的孤儿数据
  },

  async importBook(file: File) {
    set({ loading: true });
    try {
      const raw = await readTextFile(file);
      const parsed = parseChapters(raw);

      if (parsed.length === 0) {
        alert("这个文件里没识别到任何章节内容，请确认是有效的 txt 小说");
        return;
      }

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

      // 分析书籍类型 + 生成开局身份（AI 一次，缓存到书；失败则用通用模板）
      set({ templatesLoading: true });
      let templates: { bookType: string; items: BookTemplateItem[] } | null = null;
      if (hasAIAccess()) {
        try {
          templates = await generateBookTemplates(title, parsed[0]?.content ?? "");
          await db.books.update(bookId, { templates });
        } catch {
          templates = null;
        }
      }
      set({ templates, templatesLoading: false });

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
    const book = await db.books.get(bookId);

    set({
      currentBookId: bookId,
      chapterList,
      saves,
      currentSaveId: null,
      currentPC: null,
      showCreator: saves.length === 0,
      currentChapterIndex: 0,
      offset: 0,
      recentActions: [],
      npcMemories: [],
      systemState: null,
      templates: book?.templates ?? null,
      templatesLoading: false,
      savePoints: [],
      shopItems: getShopItems(book?.templates?.bookType ?? undefined),
    });

    if (saves.length > 0) {
      await get().switchSave(saves[saves.length - 1].id!);
    } else {
      await get().gotoChapter(0);
    }
  },

  async gotoChapter(index: number) {
    const { currentBookId, currentSaveId, chapterList, currentChapterIndex } = get();
    if (currentBookId == null || index < 0 || index >= chapterList.length) return;

    const chapter = await db.chapters
      .where("[bookId+index]")
      .equals([currentBookId, index])
      .first();

    if (!chapter) return;
    // 自动存档：真正翻到新的一章时，先存当前章的快照
    if (currentSaveId != null && index !== currentChapterIndex) {
      await get().autoSavePoint();
    }
    set({ currentChapterIndex: index, currentContent: chapter.content, selection: null });

    if (currentSaveId != null) {
      await db.saves.update(currentSaveId, { lastChapterIndex: index });
      // 读新章节经验（已读过的章节不再加）
      const sys = await getOrCreateSystemState(currentSaveId);
      if (!sys.readChapters.includes(index)) {
        const updated = await grantXp(currentSaveId, XP_RULES.newChapter, "阅读新章节", index);
        set({ systemState: updated });
      }
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
    const systemState = await getOrCreateSystemState(saveId);
    const savePoints = await db.savePoints.where("saveId").equals(saveId).toArray();
    savePoints.sort((a, b) => b.createdAt - a.createdAt);

    set({
      currentSaveId: saveId,
      currentPC: pc ?? null,
      showCreator: false,
      currentChapterIndex: save.lastChapterIndex, // 让 gotoChapter 不触发自动存档
      offset: save.offset,
      recentActions: recent.slice(0, 20),
      npcMemories,
      systemState,
      savePoints,
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
    await db.systemStates.where("saveId").equals(saveId).delete();
    await db.savePoints.where("saveId").equals(saveId).delete();
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
          systemState: null,
          savePoints: [],
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
      await db.systemStates.where("saveId").equals(s.id!).delete();
      await db.savePoints.where("saveId").equals(s.id!).delete();
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
          settings.provider === "off"
            ? "AI 已关闭。点右上角 ⚙️，切换到「本地 Ollama」或「DeepSeek」即可重新启用。"
            : "这是复杂行动，需要 AI 判断。你还没配置 API Key —— 点右上角 ⚙️ 配置，或用本地 Ollama（免费）。";
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

    // 行动经验（本地计算）
    const xpAmount =
      kind === "complex" ? XP_RULES.complex : kind === "medium" ? XP_RULES.medium : XP_RULES.simple;
    const reason = kind === "complex" ? "复杂行动" : kind === "medium" ? "中等行动" : "简单行动";
    const systemState = await grantXp(currentSaveId, xpAmount, reason);

    const u = getUsage();
    set({
      offset: newOffset,
      recentActions: recent.slice(0, 20),
      npcMemories,
      systemState,
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

  async runCleanup() {
    const { removed } = await cleanupOrphanData();
    return removed;
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
    const systemState = await getOrCreateSystemState(currentSaveId);
    const savePoints = await db.savePoints.where("saveId").equals(currentSaveId).toArray();
    const book = await db.books.get(save.bookId);
    if (!pc || !book) return;
    const backup = buildSaveBackup({ book, save, pc, npcMemories, actions, systemState, savePoints });
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
      db.aiCache.clear(),
      db.systemStates.clear(),
      db.savePoints.clear(),
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
      selection: null,
      cacheCount: 0,
      systemState: null,
      templates: null,
      templatesLoading: false,
      savePoints: [],
    });
  },

  // 兑换系统点数（本地规则，受偏移度约束）
  async redeem(itemId: string) {
    const { currentSaveId, systemState, offset, shopItems } = get();
    if (currentSaveId == null || !systemState) return;

    const item = shopItems.find((i) => i.id === itemId);
    if (!item) return;

    // 偏移度 ≥0.8：系统拒绝兑换
    if (offset >= 0.8) {
      const sys = await getOrCreateSystemState(currentSaveId);
      const messages = [...sys.messages, "⚠️ 世界已严重排斥，系统拒绝兑换"].slice(-20);
      await db.systemStates.update(sys.id!, { messages });
      set({ systemState: { ...sys, messages } });
      return;
    }

    if (systemState.points < item.cost) return; // 点数不足

    const points = systemState.points - item.cost;
    const redeemed = [...systemState.redeemed, { name: item.name, at: Date.now() }];
    const messages = [...systemState.messages, `✅ 兑换成功：${item.name}（-${item.cost} 点数）`].slice(-20);

    await db.systemStates.update(systemState.id!, { points, redeemed, messages });
    set({ systemState: { ...systemState, points, redeemed, messages } });
  },

  // 意难平清单：最多 3 条
  async addRegret(text: string) {
    const { currentSaveId, systemState } = get();
    if (currentSaveId == null || !systemState) return;
    const t = text.trim();
    if (!t || (systemState.regrets?.length ?? 0) >= 3) return;
    const regrets = [...(systemState.regrets ?? []), t];
    await db.systemStates.update(systemState.id!, { regrets });
    set({ systemState: { ...systemState, regrets } });
  },

  async removeRegret(index: number) {
    const { currentSaveId, systemState } = get();
    if (currentSaveId == null || !systemState) return;
    const regrets = [...(systemState.regrets ?? [])];
    regrets.splice(index, 1);
    await db.systemStates.update(systemState.id!, { regrets });
    set({ systemState: { ...systemState, regrets } });
  },

  async addReadingSeconds(n: number) {
    const { currentSaveId, systemState } = get();
    if (currentSaveId == null || !systemState) return;
    const readingSeconds = (systemState.readingSeconds ?? 0) + n;
    await db.systemStates.update(systemState.id!, { readingSeconds });
    set({ systemState: { ...systemState, readingSeconds } });
  },

  async refreshSavePoints() {
    const { currentSaveId } = get();
    if (currentSaveId == null) {
      set({ savePoints: [] });
      return;
    }
    const savePoints = await db.savePoints.where("saveId").equals(currentSaveId).toArray();
    savePoints.sort((a, b) => b.createdAt - a.createdAt);
    set({ savePoints });
  },

  async createSavePoint(name: string) {
    const { currentSaveId } = get();
    if (currentSaveId == null) return;
    const snap = await snapshotCurrentState(currentSaveId);
    await db.savePoints.add({
      saveId: currentSaveId,
      name,
      isAuto: false,
      createdAt: Date.now(),
      ...snap,
    });
    await get().refreshSavePoints();
  },

  // 自动存档：每章结束存一次，只保留最近 3 个
  async autoSavePoint() {
    const { currentSaveId } = get();
    if (currentSaveId == null) return;
    const snap = await snapshotCurrentState(currentSaveId);
    await db.savePoints.add({
      saveId: currentSaveId,
      name: "自动存档",
      isAuto: true,
      createdAt: Date.now(),
      ...snap,
    });
    const autos = await db.savePoints
      .where("saveId")
      .equals(currentSaveId)
      .and((p) => p.isAuto)
      .sortBy("createdAt");
    while (autos.length > 3) {
      const oldest = autos.shift();
      if (oldest) await db.savePoints.delete(oldest.id!);
    }
    await get().refreshSavePoints();
  },

  async restoreSavePoint(id: number) {
    const sp = await db.savePoints.get(id);
    if (!sp) return;

    await db.saves.update(sp.saveId, {
      lastChapterIndex: sp.chapterIndex,
      offset: sp.offset,
    });
    const sys = await getOrCreateSystemState(sp.saveId);
    await db.systemStates.update(sys.id!, {
      xp: sp.xp,
      level: sp.level,
      points: sp.points,
      redeemed: sp.redeemed,
      messages: sp.messages,
      readChapters: sp.readChapters,
    });
    await db.npcMemories.where("saveId").equals(sp.saveId).delete();
    if (sp.npcMemories.length) {
      await db.npcMemories.bulkAdd(
        sp.npcMemories.map((m) => ({
          saveId: sp.saveId,
          npcName: m.npcName,
          attitude: m.attitude,
          trust: m.trust,
          remembered: m.remembered,
          tendency: m.tendency,
          relationHistory: m.relationHistory,
        }))
      );
    }
    await db.actions.where("saveId").equals(sp.saveId).delete();
    if (sp.actions.length) {
      await db.actions.bulkAdd(
        sp.actions.map((a) => ({
          saveId: sp.saveId,
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
    await get().switchSave(sp.saveId);
    await get().refreshSavePoints();
  },

  async deleteSavePoint(id: number) {
    await db.savePoints.delete(id);
    await get().refreshSavePoints();
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
    saveReadingPrefs({ fontSize: n });
  },
  setLineHeight(n) {
    set({ lineHeight: n });
    saveReadingPrefs({ lineHeight: n });
  },
  setFontFamily(f) {
    set({ fontFamily: f });
    saveReadingPrefs({ fontFamily: f });
  },
  setReadingBg(b) {
    set({ readingBg: b });
    saveReadingPrefs({ readingBg: b });
  },
}));
