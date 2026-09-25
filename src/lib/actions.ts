// ============================================================
// 本地规则库（0 token）：行动分级 + 简单行动结果 + 偏移度加权。
// 这是"AI 接入之前的过渡方案"——本地规则只能给通用反馈，
// 真正的剧情理解要等 AI 模块（消耗控制之后）接入后替换。
// ============================================================

export type ActionKind = "simple" | "medium" | "complex";

// —— 分级关键词（按文档模块四）——
const COMPLEX_KEYWORDS = [
  "建", "势力", "干预", "主线", "改变", "关键", "捏造",
  "杀", "复仇", "推翻", "发动", "篡改", "联盟",
];
const MEDIUM_KEYWORDS = [
  "结交", "拉拢", "试探", "送礼", "谈判", "跟踪", "调查", "策反", "招募",
];

// 简单行动是兜底（默认），不需要关键词表
export function classifyAction(text: string): ActionKind {
  if (COMPLEX_KEYWORDS.some((k) => text.includes(k))) return "complex";
  if (MEDIUM_KEYWORDS.some((k) => text.includes(k))) return "medium";
  return "simple";
}

// —— 偏移度增量（对应文档模块五的加权）——
export function offsetDeltaFor(kind: ActionKind): number {
  switch (kind) {
    case "simple":  return 0;      // 闲聊/观察/移动：+0
    case "medium":  return 0.05;   // 影响支线角色：+0.05
    case "complex": return 0.2;    // 影响主角团核心决策：+0.2
  }
}

// —— 偏移度分级（对应文档模块五）——
export function offsetTier(offset: number): string {
  if (offset < 0.3) return "自由支线";
  if (offset < 0.6) return "明显改变 · 主线可拉回";
  if (offset < 0.8) return "世界开始排斥";
  return "剧情事件拉回";
}

// —— 多结局：根据偏移度判定结局走向 ——
export function getEnding(offset: number): { label: string; desc: string } {
  if (offset < 0.3) {
    return { label: "原著结局", desc: "你基本沿着原著路线走完了这本书，改变不多。" };
  }
  if (offset < 0.6) {
    return { label: "改变结局", desc: "你改变了不少关键事件，故事的走向已经和原著不一样了。" };
  }
  if (offset < 0.8) {
    return { label: "颠覆结局", desc: "你大幅改写了剧情，原著世界几乎被你颠覆。" };
  }
  return { label: "世界反噬", desc: "偏移过度，原著世界开始排斥你，剧情被强行拉回。" };
}

// —— 本地结果生成：简单/中等给通用模板反馈，复杂行动标记待 AI ——
export function resolveAction(text: string, kind: ActionKind, pcName: string): string {
  if (kind === "simple") {
    if (/打听|问|了解/.test(text)) {
      return `${pcName}向周围人打听了一番，得到些零碎消息，暂时没有实质进展。`;
    }
    if (/观察|看|查看|打量/.test(text)) {
      return `${pcName}仔细观察四周，把环境与人物尽收眼底，心里有了数。`;
    }
    if (/休息|睡/.test(text)) {
      return `${pcName}找了处安全的地方休息，恢复了精神。`;
    }
    if (/移动|走|去|前往|离开/.test(text)) {
      return `${pcName}按计划移动到了目标地点，一路无事。`;
    }
    return `${pcName}做了这件小事，没有引起什么波澜。（简单行动 · 本地规则 · 0 token）`;
  }

  if (kind === "medium") {
    return `${pcName}采取了试探性行动，对方有所察觉，但关系尚未发生明显变化。（中等行动 · 本地规则反馈）`;
  }

  return `${pcName}的这次重大行动需要 AI 才能准确判断后果。请先在右上角 ⚙️ 配置 API Key（或用本地 Ollama），再提交复杂行动。`;
}

// —— 从行动文本里抠"对象名"（纯本地启发式，猜错正常，AI 后由 AI 准确识别）——
const LEAD_VERBS = [
  "打听", "观察", "查看", "看看", "移动", "前往", "闲聊", "结交",
  "拉拢", "试探", "送礼", "谈判", "跟踪", "调查", "策反", "招募",
  "干预", "改变", "杀", "复仇", "推翻", "发动", "寻找",
];

export function extractTargetName(text: string): string | null {
  for (const v of LEAD_VERBS) {
    const idx = text.indexOf(v);
    if (idx >= 0) {
      const rest = text.slice(idx + v.length).trim();
      const m = rest.match(/[一-龥]{2,4}/);
      return m ? m[0] : null;
    }
  }
  return null;
}
