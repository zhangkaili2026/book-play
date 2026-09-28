// ============================================================
// 成就系统：定义成就 + 根据当前状态判定解锁（全本地，0 token）
// ============================================================

export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-complex", name: "初次干预", desc: "完成第一次复杂行动" },
  { id: "offset-0.3", name: "改写者", desc: "主线偏移度达到 0.3" },
  { id: "offset-0.6", name: "颠覆者", desc: "主线偏移度达到 0.6" },
  { id: "offset-0.8", name: "世界反噬", desc: "主线偏移度达到 0.8" },
  { id: "read-10", name: "渐入佳境", desc: "累计阅读 10 个章节" },
  { id: "read-50", name: "书海沉浮", desc: "累计阅读 50 个章节" },
  { id: "npc-5", name: "社交达人", desc: "与 5 个角色建立关系" },
  { id: "shop-1", name: "首次兑换", desc: "在系统商城完成第一次兑换" },
];

export function checkAchievements(state: {
  offset: number;
  complexCount: number;
  readCount: number;
  npcCount: number;
  redeemedCount: number;
}): Set<string> {
  const u = new Set<string>();
  if (state.complexCount >= 1) u.add("first-complex");
  if (state.offset >= 0.3) u.add("offset-0.3");
  if (state.offset >= 0.6) u.add("offset-0.6");
  if (state.offset >= 0.8) u.add("offset-0.8");
  if (state.readCount >= 10) u.add("read-10");
  if (state.readCount >= 50) u.add("read-50");
  if (state.npcCount >= 5) u.add("npc-5");
  if (state.redeemedCount >= 1) u.add("shop-1");
  return u;
}
