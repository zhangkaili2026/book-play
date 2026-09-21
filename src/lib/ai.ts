// ============================================================
// AI 客户端：调用 OpenAI 兼容接口（DeepSeek / Qwen / GLM / Kimi / Ollama）。
// 浏览器直连；API Key 只留在本地，不上传任何服务器。
// ============================================================

import { loadSettings, addUsage, hasAIAccess } from "./settings";

export interface AIResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

export async function callLLM(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens = 800
): Promise<AIResult> {
  const s = loadSettings();
  if (!hasAIAccess()) {
    throw new Error("未配置 API Key");
  }

  const res = await fetch(`${s.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(s.apiKey ? { Authorization: `Bearer ${s.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: s.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 请求失败 (${res.status})：${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const completionTokens: number = data.usage?.completion_tokens ?? 0;
  const cost =
    (promptTokens * s.inputPricePerM + completionTokens * s.outputPricePerM) / 1_000_000;

  addUsage(promptTokens, completionTokens, cost);
  return { content, promptTokens, completionTokens, cost };
}

// 组装「世界回应器」提示词。关键：输入量恒定（只带角色摘要 + 最近 5 条行动），
// 不塞整章原文、不随游戏时长增长 —— 对应文档模块八「保证每次 AI 输入量恒定」。
export function buildActionPrompt(ctx: {
  pc: {
    name: string;
    identity: string;
    faction: string;
    abilities: string[];
    power: string;
    resources: string[];
  };
  chapterTitle: string;
  recentActions: string[];
  action: string;
}) {
  const system = [
    "你是一个互动小说的「世界回应器」。玩家在书里扮演一个角色，会向你提交行动。",
    "你只负责判断：这个行动是否可行、会带来什么后果、影响到哪些角色/势力/主线节点。",
    "规则：",
    "1. 原文是底本，你绝不能重写原文，只输出对这个行动的回应。",
    "2. 用第二人称对玩家说话，200~500 字。",
    "3. 如果行动超出角色能力或势力，诚实指出，并给出迂回建议。",
    "4. 绝不跳出这本书的世界观。",
  ].join("\n");

  const user = [
    `【你的角色】姓名：${ctx.pc.name}；身份：${ctx.pc.identity}；阵营：${ctx.pc.faction}`,
    `【能力】${ctx.pc.abilities.join("、") || "无"}；【势力】${ctx.pc.power}；【资源】${ctx.pc.resources.join("、") || "无"}`,
    `【当前章节】${ctx.chapterTitle}`,
    ctx.recentActions.length
      ? `【最近行动】${ctx.recentActions.map((a, i) => `${i + 1}. ${a}`).join("；")}`
      : "",
    `【本次行动】${ctx.action}`,
    "",
    "请回应这次行动。",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}
