// ============================================================
// 系统面板：经验值 / 等级 / 点数 / 兑换（全部本地规则，0 token）
// 兑换受主线偏移度约束，不能破坏主线。
// ============================================================

export const XP_PER_LEVEL = 100;      // 100 经验升一级
export const POINTS_PER_LEVEL = 10;   // 每升一级送 10 点数

// 经验规则（本地计算，不调 AI）
export const XP_RULES = {
  newChapter: 5,   // 读新章节
  simple: 2,       // 简单行动
  medium: 8,       // 中等行动
  complex: 20,     // 复杂行动
} as const;

export type RedeemCategory = "info" | "ability" | "item" | "power";

export interface RedeemItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  category: RedeemCategory;
}

// 可兑换项（本地规则）
export const REDEEM_ITEMS: RedeemItem[] = [
  { id: "info-npc", name: "NPC 情报", desc: "查看一个关键角色的当前态度与信任度", cost: 5, category: "info" },
  { id: "item-resource", name: "补充资源", desc: "获得一批可支配资源", cost: 10, category: "item" },
  { id: "ability-temp", name: "临时技能", desc: "临时获得一项能力（5 章内有效）", cost: 15, category: "ability" },
  { id: "power-buff", name: "势力加成", desc: "势力小幅度提升", cost: 20, category: "power" },
];

export const CATEGORY_LABEL: Record<RedeemCategory, string> = {
  info: "情报",
  ability: "能力",
  item: "道具",
  power: "势力",
};
