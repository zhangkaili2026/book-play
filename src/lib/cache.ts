// ============================================================
// AI 缓存（模块九）：相同状态 + 相同行动 → 直接复用结果，0 token。
// 缓存键 = 模型 + 角色名 + 章节 + 行动文本（近似"相同状态"）。
// ============================================================

import { db } from "./db";
import type { AIResult } from "./ai";

// AI 缓存上限：避免 IndexedDB 无限增长（不依赖 schema，无需迁移）
const MAX_CACHE_ENTRIES = 500;

export function buildCacheKey(input: {
  model: string;
  saveId: number;
  pcName: string;
  chapterIndex: number;
  recentActions: string[];
  action: string;
}): string {
  // 键里带上"存档 id + 最近行动"，避免不同存档 / 不同局势互相错误命中缓存
  const recent = input.recentActions.join("|");
  return `${input.model}||${input.saveId}||${input.pcName}||${input.chapterIndex}||${recent}||${input.action}`;
}

export async function getCached(key: string): Promise<AIResult | null> {
  const entry = await db.aiCache.where("key").equals(key).first();
  if (!entry) return null;
  return {
    content: entry.result,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    cost: 0, // 缓存命中：0 新费用
    cached: true,
  };
}

export async function setCached(key: string, result: AIResult): Promise<void> {
  // 覆盖同键旧条目，避免重复累积
  await db.aiCache.where("key").equals(key).delete();
  await db.aiCache.add({
    key,
    result: result.content,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    cost: result.cost,
    createdAt: Date.now(),
  });
  // 超上限时按主键（插入顺序）淘汰最旧条目，避免无限增长
  const count = await db.aiCache.count();
  if (count > MAX_CACHE_ENTRIES) {
    const oldest = await db.aiCache
      .orderBy(":id")
      .limit(count - MAX_CACHE_ENTRIES)
      .primaryKeys();
    if (oldest.length) await db.aiCache.bulkDelete(oldest);
  }
}

export async function getCacheCount(): Promise<number> {
  return db.aiCache.count();
}

export async function clearCache(): Promise<void> {
  await db.aiCache.clear();
}
