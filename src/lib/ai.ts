// ============================================================
// AI 客户端：调用 OpenAI 兼容接口（DeepSeek / Qwen / GLM / Kimi / Ollama）。
// 浏览器直连；API Key 只留在本地，不上传任何服务器。
// ============================================================

import { loadSettings, addUsage, hasAIAccess } from "./settings";
import type { BookTemplateItem } from "./db";

export interface AIResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  cached?: boolean; // 是否来自缓存（0 token）
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
  if (!content.trim()) {
    throw new Error("AI 返回内容为空");
  }
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

// 根据书名 + 开头片段，AI 判断书籍类型并生成 3 个开局身份（只调一次，结果缓存）
export async function generateBookTemplates(
  title: string,
  sample: string
): Promise<{ bookType: string; items: BookTemplateItem[] }> {
  const system =
    "你是网文设定分析助手。根据书名和开头片段判断书籍类型（修仙/后宫/权谋/都市/悬疑等），并生成 3 个符合该书世界观的「开局初始身份」。";
  const user = [
    `书名：${title}`,
    "开头片段：",
    sample.slice(0, 800),
    "",
    "请严格输出 JSON（不要多余文字），格式：",
    '{"bookType":"类型","items":[{"label":"身份标签","identity":"身份描述","faction":"阵营","abilities":["能力"],"connections":["人脉"],"power":"势力","resources":["资源"]}]}',
  ].join("\n");

  const res = await callLLM(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    800
  );

  const content = res.content.trim();
  // 先直接解析；失败则提取内容里的第一个 { ... }
  try {
    const parsed = JSON.parse(content);
    if (parsed?.bookType && Array.isArray(parsed.items) && parsed.items.length) return parsed;
  } catch {
    /* 继续尝试提取 */
  }
  const m = content.match(/\{[\s\S]*\}/);
  if (m) {
    const parsed = JSON.parse(m[0]);
    if (parsed?.bookType && Array.isArray(parsed.items) && parsed.items.length) return parsed;
  }
  throw new Error("无法解析 AI 返回的身份模板");
}
