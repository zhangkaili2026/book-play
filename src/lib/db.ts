// ============================================================
// 数据层（唯一真相源）
// 所有持久化数据都存浏览器 IndexedDB，用 Dexie 封装。
//
// 表分两类：
//   共享且不可变 —— books / chapters（原文永不改动）
//   每存档独立   —— saves / characters / npcMemories / actions
// ============================================================

import Dexie, { type Table } from "dexie";

// —— 书：每导入一本 txt 就新增一条 ——
export interface Book {
  id?: number;            // 自增主键，Dexie 自动分配
  title: string;          // 书名
  author: string;         // 作者（暂留空，后期可从 txt 识别）
  totalChars: number;     // 总字数
  chapterCount: number;   // 章节数
  createdAt: number;      // 导入时间戳（毫秒）
  lastReadIndex: number;  // 纯阅读（未开局）时读到的章节
  templates?: { bookType: string; items: BookTemplateItem[] } | null; // AI 分析出的开局身份模板（缓存）
}

// 开局身份模板（AI 根据书籍类型生成，与开局界面里的通用模板结构一致）
export interface BookTemplateItem {
  label: string;          // 身份标签，如"外门弟子"
  identity: string;       // 身份描述
  faction: string;        // 阵营
  abilities: string[];    // 初始能力
  connections: string[];  // 人脉
  power: string;          // 势力
  resources: string[];    // 资源
}

// —— 章：一本小说拆成的每一章 ——
export interface Chapter {
  id?: number;
  bookId: number;         // 属于哪本书
  index: number;          // 章节序号（从 0 开始）
  title: string;          // 章节标题
  content: string;        // 章节正文 —— 原文，永不改动
  charCount: number;      // 本章字数
  nodes: PlotNode[];      // 剧情节点标记（模块一预留）
  actions: ActionMark[];  // 已插入行动标记（模块四预留）
}

export interface PlotNode {
  id: string;
  offset: number;
  type: string;
  label: string;
}

export interface ActionMark {
  id: string;
  offset: number;
  summary: string;
  kind: "simple" | "medium" | "complex";
  result: string;
}

// —— 存档：一次"游玩"，绑定一本书 + 一个锁定的 PC ——
export interface Save {
  id?: number;
  bookId: number;
  name: string;             // 存档名
  pcId: number;             // 指向 characters 里的 PC
  offset: number;           // 主线偏移度 0~1（影响层模块用）
  createdAt: number;
  lastChapterIndex: number; // 这个存档的阅读进度
}

// —— 角色：PC 和 NPC 共用一张表，用 isPC 区分 ——
export interface Character {
  id?: number;
  saveId: number;
  name: string;
  isPC: boolean;            // 是否玩家角色（一个存档只有一个 PC）
  identity: string;         // 身份
  faction: string;          // 阵营
  abilities: string[];      // 初始能力
  connections: string[];    // 人脉
  power: string;            // 势力
  resources: string[];      // 资源
}

// —— NPC 记忆（模块五影响层用，本模块先建表）——
export interface NpcMemory {
  id?: number;
  saveId: number;
  npcName: string;
  attitude: string;          // 对玩家态度
  trust: number;             // 信任度 0~1
  remembered: string[];      // 记住的事
  tendency: string;          // 行为倾向
  relationHistory: string[]; // 关系变化史
}

// —— 行动记录 ——
export interface ActionRecord {
  id?: number;
  saveId: number;
  chapterIndex: number;
  kind: "simple" | "medium" | "complex";
  content: string;           // 玩家输入的行动
  result: string;            // 行动结果
  createdAt: number;
  // AI 消耗（仅复杂行动有值）
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  cached?: boolean; // 是否命中缓存（0 token）
  paraIndex?: number; // 行动锚定的段落序号（旁注定位用）
}

// —— AI 缓存（模块九：相同状态+相同行动 → 复用，0 token）——
export interface AiCacheEntry {
  id?: number;
  key: string;             // 缓存键
  result: string;          // 缓存的 AI 结果
  promptTokens: number;
  completionTokens: number;
  cost: number;            // 原始费用（参考）
  createdAt: number;
}

// —— 系统面板（经验值/等级/点数/兑换，每存档一份）——
export interface SystemState {
  id?: number;
  saveId: number;
  xp: number;              // 经验值
  level: number;           // 等级
  points: number;          // 系统点数
  redeemed: { name: string; at: number }[]; // 兑换记录
  messages: string[];      // 系统提示（最近几条）
  readChapters: number[];  // 已读章节（用于"读新章节"经验判定）
}

// —— 存档点（游戏状态快照，用于"玩崩了读档回退"）——
export interface SavePoint {
  id?: number;
  saveId: number;
  name: string;
  isAuto: boolean;         // 是否自动存档
  createdAt: number;
  chapterIndex: number;    // 保存时所在章节
  offset: number;          // 偏移度快照
  xp: number;
  level: number;
  points: number;
  redeemed: { name: string; at: number }[];
  messages: string[];
  readChapters: number[];
  npcMemories: NpcMemory[];   // NPC 记忆副本
  actions: ActionRecord[];    // 行动记录副本
}

class BookPlayDB extends Dexie {
  books!: Table<Book, number>;
  chapters!: Table<Chapter, number>;
  saves!: Table<Save, number>;
  characters!: Table<Character, number>;
  npcMemories!: Table<NpcMemory, number>;
  actions!: Table<ActionRecord, number>;
  aiCache!: Table<AiCacheEntry, number>;
  systemStates!: Table<SystemState, number>;
  savePoints!: Table<SavePoint, number>;

  constructor() {
    super("bookplay");
    this.version(1).stores({
      books: "++id, title, createdAt",
      chapters: "++id, bookId, index, [bookId+index]",
    });
    // v2：新增存档 / 角色 / NPC记忆 / 行动记录四张表
    this.version(2).stores({
      saves: "++id, bookId, createdAt",
      characters: "++id, saveId, isPC",
      npcMemories: "++id, saveId, npcName",
      actions: "++id, saveId, chapterIndex",
    });
    // v3：新增 AI 缓存表
    this.version(3).stores({
      aiCache: "++id, key",
    });
    // v4：新增系统面板表（经验值/等级/点数/兑换）
    this.version(4).stores({
      systemStates: "++id, saveId",
    });
    // v5：新增存档点表（快照，用于读档回退）
    this.version(5).stores({
      savePoints: "++id, saveId, createdAt",
    });
  }
}

export const db = new BookPlayDB();
