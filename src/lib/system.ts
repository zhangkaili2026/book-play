import { db, type SystemState, type Save, type Character, type NpcMemory } from "./db";
// ============================================================
// 系统面板：经验值 / 等级 / 点数 / 商城兑换（全部本地规则，0 token）
// 商城兑换项按书籍类型动态生成，受主线偏移度约束。
// ============================================================

export const XP_PER_LEVEL = 100;      // 100 经验升一级
export const POINTS_PER_LEVEL = 10;   // 每级送 10 点数

export const XP_RULES = {
  newChapter: 5,
  simple: 2,
  medium: 8,
  complex: 20,
} as const;

export type RedeemCategory = "info" | "ability" | "item" | "power" | "special";
export type ShopTier = "初级" | "中级" | "高级" | "顶级";

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  category: RedeemCategory;
  tier: ShopTier;
  temporary?: boolean; // 临时物品（如「临时技能」5 章后过期）
  target?: "abilities" | "connections" | "resources";
}

export const CATEGORY_LABEL: Record<RedeemCategory, string> = {
  info: "情报",
  ability: "能力",
  item: "道具",
  power: "势力",
  special: "特殊",
};

export const TIER_ORDER: ShopTier[] = ["初级", "中级", "高级", "顶级"];

// 默认商城（未识别出书籍类型时用）
export const DEFAULT_SHOP: ShopItem[] = [
  { id: "info-npc", name: "NPC 情报", desc: "查看一个关键角色的态度与信任度", cost: 5, category: "info", tier: "初级" },
  { id: "item-resource", name: "补充资源", desc: "获得一批可支配资源", cost: 10, category: "item", tier: "初级" },
  { id: "ability-temp", name: "临时技能", desc: "临时获得一项能力（5 章内有效）", cost: 20, category: "ability", tier: "中级", temporary: true },
  { id: "power-buff", name: "势力加成", desc: "势力小幅度提升", cost: 40, category: "power", tier: "中级" },
  { id: "info-key", name: "关键情报", desc: "得知一条影响主线走向的关键消息", cost: 80, category: "info", tier: "高级" },
  { id: "special-fate", name: "命运转折", desc: "获得一次改变某个关键事件的机会", cost: 200, category: "special", tier: "顶级" },
];

// 按书籍类型生成的商城（本地规则，不调 AI）
export const SHOP_BY_TYPE: Record<string, ShopItem[]> = {
  修仙: [
    { id: "xiu-1", name: "聚气丹", desc: "加快修炼速度的丹药", cost: 5, category: "item", tier: "初级" },
    { id: "xiu-2", name: "功法残卷", desc: "一门基础功法", cost: 10, category: "ability", tier: "初级" },
    { id: "xiu-3", name: "灵器·飞剑", desc: "一把趁手的法器", cost: 30, category: "item", tier: "中级" },
    { id: "xiu-4", name: "秘境情报", desc: "一处秘境的进入方法", cost: 40, category: "info", tier: "中级" },
    { id: "xiu-5", name: "筑基丹", desc: "大幅提升突破几率", cost: 80, category: "item", tier: "高级" },
    { id: "xiu-6", name: "天阶功法", desc: "足以开宗立派的功法", cost: 200, category: "ability", tier: "顶级" },
  ],
  权谋: [
    { id: "quan-1", name: "密信", desc: "一封关键密信", cost: 5, category: "info", tier: "初级" },
    { id: "quan-2", name: "暗卫", desc: "一名忠心暗卫", cost: 30, category: "power", tier: "中级" },
    { id: "quan-3", name: "朝堂情报", desc: "朝中动向一览", cost: 40, category: "info", tier: "中级" },
    { id: "quan-4", name: "重臣之谊", desc: "一位重臣的友谊", cost: 80, category: "power", tier: "高级" },
    { id: "quan-5", target: "resources", name: "兵符", desc: "调动一军的凭证", cost: 200, category: "power", tier: "顶级" },
  ],
  后宫: [
    { id: "gong-1", name: "宫女人脉", desc: "几个机灵的宫女", cost: 5, category: "power", tier: "初级" },
    { id: "gong-2", name: "珍稀香料", desc: "难得的香料", cost: 10, category: "item", tier: "初级" },
    { id: "gong-3", name: "惊世乐谱", desc: "一曲惊四座的乐谱", cost: 30, category: "item", tier: "中级" },
    { id: "gong-4", name: "恩宠机会", desc: "一次面圣的良机", cost: 80, category: "info", tier: "高级" },
    { id: "gong-5", target: "resources", name: "凤印", desc: "后宫至高权力的象征", cost: 200, category: "power", tier: "顶级" },
  ],
  都市: [
    { id: "du-1", name: "商业情报", desc: "一条赚钱的消息", cost: 5, category: "info", tier: "初级" },
    { id: "du-2", name: "启动资金", desc: "一笔启动资金", cost: 10, category: "item", tier: "初级" },
    { id: "du-3", name: "律师人脉", desc: "一位律师朋友", cost: 30, category: "power", tier: "中级" },
    { id: "du-4", name: "技术专利", desc: "一项核心专利", cost: 80, category: "item", tier: "高级" },
    { id: "du-5", name: "顶级人脉", desc: "一位大人物的承诺", cost: 200, category: "power", tier: "顶级" },
  ],
  悬疑: [
    { id: "xuan-1", name: "关键线索", desc: "一条关键线索", cost: 5, category: "info", tier: "初级" },
    { id: "xuan-2", name: "伪装道具", desc: "一套伪装", cost: 30, category: "item", tier: "中级" },
    { id: "xuan-3", name: "关键证据", desc: "一份关键证据", cost: 30, category: "info", tier: "中级" },
    { id: "xuan-4", name: "审讯技巧", desc: "一套审讯方法", cost: 40, category: "ability", tier: "中级" },
    { id: "xuan-5", name: "真相碎片", desc: "逼近真相的关键碎片", cost: 200, category: "special", tier: "顶级" },
  ],
};

// 根据书籍类型取商城（匹配不到则用默认商城）
export function getShopItems(bookType: string | undefined): ShopItem[] {
  if (!bookType) return DEFAULT_SHOP;
  for (const [key, items] of Object.entries(SHOP_BY_TYPE)) {
    if (bookType.includes(key)) return items;
  }
  return DEFAULT_SHOP;
}

// 名场面关键词（读到这些内容时提示"此处可干预"）
export const FAMOUS_SCENE_KEYWORDS = [
  "退婚", "决斗", "大比", "夺宝", "突破", "生死", "告白",
  "背叛", "复仇", "结盟", "身世", "真相", "危机", "秘密", "传承",
];

export async function getOrCreateSystemState(saveId: number): Promise<SystemState> {
  return db.transaction("rw", [db.saves, db.systemStates], async () => {
    if (!await db.saves.get(saveId)) throw new Error("Save no longer exists");
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
        quests: [],
        tempAbilities: [],
      });
      sys = (await db.systemStates.get(id))!;
    }
    return sys;
  });
}

export async function grantXp(
  saveId: number,
  amount: number,
  reason: string,
  markChapterRead?: number,
  bonusPoints = 0
): Promise<SystemState> {
  return db.transaction("rw", [db.saves, db.systemStates], async () => {
    const sys = await getOrCreateSystemState(saveId);
    if (markChapterRead != null && sys.readChapters.includes(markChapterRead)) return sys;
    const xp = sys.xp + amount;
    const level = Math.floor(xp / XP_PER_LEVEL) + 1;
    const levelUps = level - sys.level;
    const points = sys.points + levelUps * POINTS_PER_LEVEL + bonusPoints;

    const messages = [...sys.messages, `+${amount} 经验（${reason}）`];
    if (levelUps > 0) {
      messages.push(`🎉 升级到 ${level} 级，获得 ${levelUps * POINTS_PER_LEVEL} 点数`);
    }
    if (bonusPoints > 0) {
      messages.push(`+${bonusPoints} 点数（关键事件）`);
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
  });
}

export async function updateSystemState(
  saveId: number,
  patch: (sys: SystemState, save: Save) => Partial<SystemState> | null
): Promise<SystemState | null> {
  return db.transaction("rw", [db.saves, db.systemStates], async () => {
    const save = await db.saves.get(saveId);
    if (!save) return null;
    const sys = await getOrCreateSystemState(saveId);
    const changes = patch(sys, save);
    if (!changes) return sys;
    await db.systemStates.update(sys.id!, changes);
    return { ...sys, ...changes };
  });
}

export function buildRedeemResult(item: ShopItem, npcMemories: NpcMemory[]): string {
  const target = item.target ?? (item.category === "ability" ? "abilities" : item.category === "item" ? "resources" : item.category === "power" ? "connections" : null);
  if (target && !item.temporary) {
    const label = { abilities: "能力", connections: "人脉", resources: "资源" }[target];
    return `已获得「${item.name}」：${item.desc}（已加入${label}栏）`;
  }
  if (item.id === "info-npc") {
    if (npcMemories.length === 0) {
      return "你还没有结识任何角色。先做几次「结交 / 试探」行动，情报才有内容。";
    }
    return (
      "已识别角色的态度与信任：" +
      npcMemories
        .map((m) => `${m.npcName}（${m.attitude}，信任 ${Math.round(m.trust * 100)}%）`)
        .join("；")
    );
  }
  if (item.category === "info") {
    return `你获知了与「${item.name}」相关的关键内情，将在后续剧情中发挥作用。`;
  }
  if (item.category === "item") return `已获得「${item.name}」：${item.desc}（已加入资源栏）`;
  if (item.category === "ability") {
    return item.temporary
      ? `已获得临时能力「${item.name}」（5 章内有效，到期自动失效）`
      : `已习得「${item.name}」：${item.desc}（已加入能力栏）`;
  }
  if (item.category === "power") return `已获得势力「${item.name}」：${item.desc}（已加入资源栏）`;
  return `获得「${item.name}」：${item.desc}`;
}

export function itemMechanicalPatch(item: ShopItem, pc: Character): Partial<Character> | null {
  const target = item.target ?? (item.category === "ability" ? "abilities" : item.category === "item" ? "resources" : item.category === "power" ? "connections" : null);
  if (!target || pc[target].includes(item.name)) return null;
  return { [target]: [...pc[target], item.name] };
}
