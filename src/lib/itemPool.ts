import type { ItemRarity } from "./db";
import type { ShopItem } from "./system";
export interface PoolItem { name: string; type: string; rarity: ItemRarity; desc: string; effect: string; }
export const RARITY_LABEL = {common:"普通",rare:"稀有",epic:"史诗",legendary:"传说"};
export const RARITY_WEIGHT = {common:1,rare:2,epic:3,legendary:4};
const groups: Record<string, Record<string,string>> = {
  "修仙/玄幻/奇幻": {
    "丹药": "聚气丹 筑基丹 结丹丹 元婴丹 化神丹 回气丹 疗伤丹 辟谷丹 洗髓丹 驻颜丹 破障丹 悟道丹 九转还魂丹 补天丹 涅槃丹 续命丹 解毒丹 淬体丹 凝魂丹",
    "功法": "吐纳法 御剑术 遁地术 隐身术 炼丹术 炼器术 阵法 驭兽术 符箓术 身外化身 第二元神 双修秘法 神识秘法 血脉觉醒法 燃血秘术",
    "法宝": "飞剑 储物袋 护身灵符 阵旗 炼丹炉 聚灵阵盘 缚妖索 传音符 飞行法宝 本命法宝 招魂幡 捆仙绳 山河社稷图",
    "材料": "灵石 灵草 万年灵芝 朱果 龙涎草 妖兽内丹 天外陨铁 紫金砂 寒冰玄铁 灵泉 悟道茶 菩提子 混沌珠",
    "道具": "灵宠蛋 坐骑 秘境地图 洞府 传承玉简 宗门令牌 拜师贴 灵田"
  },
  "武侠": {
    "武器": "铁剑 宝刀 长枪 匕首 峨眉刺 软剑 重剑 唐刀 双钩 判官笔 暗器 唐门暗器 袖箭",
    "丹药": "金疮药 疗伤圣药 黑玉断续膏 九花玉露丸 大还丹 解毒丹 蒙汗药解药 续命丹 麻沸散",
    "功法": "内功心法 剑法 刀法 掌法 轻功身法 点穴手法 暗器手法 易容术 缩骨功 狮吼功 吸星大法",
    "钱财": "镖银 金叶子 银票 铜钱 珠宝 玉佩",
    "道具": "蒙汗药 迷香 人皮面具 夜行衣 信鸽 江湖令牌 火折子 飞镖 毒针 火铳",
    "情报": "门派情报 藏宝图 密道图 仇家下落 武林盟主密辛 秘籍下落"
  },
  "宫斗/宅斗/女尊/古言/后宫": {
    "丹药": "生子丹 坐胎药 避孕药 暖宫丸 美容养颜丹 驻颜丹 安神香 催情香 迷情香 麝香 红花 毒药 解药 催产药 堕胎药",
    "道具": "胭脂水粉 螺子黛 云锦 金步摇 凤钗 玉簪 华服 绣鞋 护甲 团扇 手炉",
    "食谱": "御膳秘方 药膳方 毒膳配方 糕点方子 茶艺 酿酒方",
    "人才": "暗卫 贴身宫女 奶娘 太医 嬷嬷 太监 侍卫 教习 乳母 绣娘",
    "情报": "密信 账本 罪证 书信 生辰八字 通奸证物",
    "功法": "女红 厨艺 舞艺 琴棋书画 医术 毒术 驭人之术 礼仪 插花 焚香",
    "身份": "免死金牌 诰命 封号 凤印 金册",
    "钱财": "银票 赏赐 田产 铺面 庄子",
    "信物": "玉佩 同心结 巫蛊人偶"
  },
  "权谋/历史/军事": {
    "情报": "密信 朝堂情报 边关军报 奏折 账本 密诏 口供 罪证 族谱 舆图 密道图 城防图 边关地形图 堪舆图",
    "人才": "暗卫 死士 谋士 幕僚 武将 斥候 锦衣卫 说客 游侠 刺客",
    "道具": "兵符 虎符 调令 军饷 粮草 兵器 战马 盔甲 火器 攻城器械",
    "钱财": "黄金 白银 银票 盐引 茶引 田契 矿权 商路 漕运",
    "身份": "官印 令牌 免死金牌 尚方宝剑 丹书铁券 爵位 封地",
    "信物": "联姻信物 盟约"
  },
  "都市/娱乐圈/校园/电竞/体育": {
    "钱财": "现金 支票 股权 房产 豪车 启动资金 金条 基金",
    "人才": "律师 医生 警察 记者 政要人情 大佬承诺 商业伙伴 黑客 投资人",
    "科技": "专利 技术方案 源代码 产品配方 商业计划书 版权 IP",
    "情报": "商业情报 竞品资料 内幕消息 黑料 证据 账本 绯闻",
    "道具": "窃听器 定位器 录音笔 假身份 签证 护照 监控 无人机",
    "事业": "剧本 代言 综艺资源 经纪人 公关团队 水军 热搜 外设 教练 战队 奖学金 导师推荐信"
  },
  "悬疑/刑侦/盗墓/灵异/克苏鲁": {
    "情报": "目击证词 监控 指纹 DNA 血迹 足迹 毛发 纤维 弹道 毒物 凶器 遗书 日记 账本 手机 录音 照片 信件 物证 尸检报告",
    "道具": "伪装 假身份 窃听器 监控 撬锁工具 取证箱 紫外灯 夜视仪",
    "功法": "审讯技巧 法医知识 心理学 推理 密码学 痕迹学 风水 盗墓知识 符箓",
    "人才": "线人 助手 法医 警察 黑客 心理侧写师 摸金校尉 道士 驱魔人",
    "法器": "桃木剑 符箓 罗盘 黑驴蹄子 朱砂 八卦镜 摄魂铃 招魂幡"
  },
  "无限流/快穿/系统/诸天": {
    "技能卡": "技能卡 武器卡 治疗卡 复活卡 传送卡 隐身卡 变身卡 召唤卡",
    "道具": "新手礼包 道具商城券 积分 复活币 存档点 装备箱 消耗品 系统商店 任务奖励 成就奖励 签到奖励 转盘抽奖 副本门票 世界碎片 诸天坐标 位面穿梭 时空锚点",
    "功法": "血脉 异能 天赋点 属性点 技能点"
  },
  "星际/科幻/末世/赛博朋克/机甲": {
    "载具": "机甲 飞船 战机 装甲车 悬浮车 动力装甲",
    "武器": "激光枪 等离子炮 电磁炮 脉冲 能量剑 粒子武器",
    "药剂": "基因改造药剂 强化药剂 修复液 解毒剂 兴奋剂 镇静剂 丧尸疫苗",
    "科技": "芯片 AI 神经网络 量子计算机 能源核心 反物质 义体 义眼 义肢 记忆芯片 防火墙 黑冰",
    "道具": "净水器 食物 汽油 武器弹药 庇护所"
  },
  "言情/耽美/百合/水仙": {
    "信物": "玉佩 戒指 同心结 情书 定情信物 婚戒",
    "助攻": "月老红绳 催情香 助攻好友 误会澄清 机会制造",
    "事业": "摄影合同 创业项目 演出机会",
    "道具": "香水 礼服 约会券 礼物 旅行 时空回溯 分身 镜像 克隆 双生"
  },
  "种田/美食/年代": {
    "农具": "良种 种子 农具 耕牛 水车 肥料 石磨 纺车 织布机 窑 铁匠铺",
    "食谱": "菜谱 酿酒方 酱油方 豆腐方 辣酱方",
    "道具": "鸡鸭 猪牛羊 鱼苗 粮票 布票 工业券 老物件 收音机 自行车"
  }
};
// Rarity measures narrative significance, never combat stats or a guaranteed plot rewrite.
export const ITEM_POOL_BY_TYPE: Record<string, PoolItem[]> = Object.fromEntries(Object.entries(groups).map(([genre,types]) => [genre,Object.entries(types).flatMap(([type,names]) => names.split(" ").map((name,i) => ({name,type,rarity:(["common","rare","epic","legendary"] as const)[Math.min(3,Math.floor(i*4/names.split(" ").length))],desc:`${genre.split("/")[0]}题材的${type}：${name}。仅影响支线叙事，不改写原文。`,effect:`你动用了「${name}」，尝试为当前行动创造与${type}相关的机会；实际效果仍受身份、环境与剧情约束。`})))]));
export const DEFAULT_POOL: PoolItem[] = [
 {name:"铁剑",type:"武器",rarity:"common",desc:"一柄朴素的随身铁剑。",effect:"你握紧铁剑，谨慎应对眼前的险境。"},
 ...["common","rare","epic","legendary"].map((rarity,i) => ({name:["旅人信笺","旧友引荐信","关键证物","珍贵盟约"][i],type:"信物",rarity:rarity as ItemRarity,desc:"一份可用于支线交涉的凭据。",effect:"你出示凭据，尝试争取新的交涉机会。"})),
];
export function getItemPool(bookType = ""): PoolItem[] {
 const key=Object.keys(ITEM_POOL_BY_TYPE).find(k=>k.split("/").some(alias=>bookType.includes(alias)));
 return key ? ITEM_POOL_BY_TYPE[key] : DEFAULT_POOL;
}
export function drawItem(pool: PoolItem[], gacha=false, random= Math.random): PoolItem {
  // 常规兑换偏普通/稀有；抽卡搏高稀有度（史诗+传说概率更高，才值得多花点数）
  const weights: [ItemRarity, number][] = gacha
    ? [["common", 0.40], ["rare", 0.30], ["epic", 0.20], ["legendary", 0.10]]
    : [["common", 0.50], ["rare", 0.30], ["epic", 0.15], ["legendary", 0.05]];
  const roll = random();
  let acc = 0, rarity: ItemRarity = "common";
  for (const [r, w] of weights) { acc += w; if (roll < acc) { rarity = r; break; } }
  let candidates = pool.filter(i => i.rarity === rarity);
  if (!candidates.length) candidates = pool;
  return candidates[Math.floor(random() * candidates.length)];
}
export function getInventoryShop(bookType=""): ShopItem[] {
 return [...Array.from(new Set(getItemPool(bookType).map(i=>i.type))).map(type=>({id:`pool:${type}`,name:type,desc:`从${type}池随机获得一件，数量 1～3`,cost:20,category:"item" as const,tier:"初级" as const})),{id:"gacha",name:"🎴 抽卡",desc:"普通40% / 稀有30% / 史诗20% / 传说10%，数量1～3",cost:40,category:"special",tier:"中级"}];
}

export function inventoryPrompt(items: import("./db").InventoryItem[], messages: string[] = [], tempAbilities: { name: string; expiresAtChapter: number }[] = []): string {
 const held = [...items].sort((a,b)=>(b.id??0)-(a.id??0)).slice(0,8).sort((a,b)=>RARITY_WEIGHT[b.rarity]-RARITY_WEIGHT[a.rarity]);
 const tempLine = tempAbilities.length ? "临时能力（短期有效）：" + tempAbilities.slice(0,5).map(t=>t.name.slice(0,20)).join("、") + "。" : "";
 return `你当前持有：${held.map(i=>`${i.name.slice(0,30)}×${i.quantity}【${RARITY_LABEL[i.rarity]}】`).join("、") || "无"}。稀有度越高，叙事分量越重，但仍须遵守世界观与行动条件。${tempLine}\n近期使用：${messages.filter(m=>m.startsWith("使用「")).slice(-3).map(m=>m.slice(0,180)).join("；") || "无"}`;
}
