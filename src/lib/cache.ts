// ============================================================
// AI 缓存（模块九）：相同状态 + 相同行动 → 直接复用结果，0 token。
// 缓存键 = 模型 + 角色名 + 章节 + 行动文本（近似"相同状态"）。
// ============================================================

import { db } from "./db";
import type { AIResult } from "./ai";

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
  await db.aiCache.add({
    key,
    result: result.content,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    cost: result.cost,
    createdAt: Date.now(),
  });
}

export async function getCacheCount(): Promise<number> {
  return db.aiCache.count();
}

export async function clearCache(): Promise<void> {
  await db.aiCache.clear();
}
