// ============================================================
// 应用级配置 + 用量统计（存 localStorage，本地，不上传）
// API Key 由用户自己填写，存在自己浏览器里。
// ============================================================

export interface AISettings {
  apiKey: string;
  baseUrl: string;          // OpenAI 兼容接口地址，如 https://api.deepseek.com/v1
  model: string;            // 模型名
  dailyBudget: number;      // 每日预算（元）
  inputPricePerM: number;   // 每百万输入 token 价格（元）
  outputPricePerM: number;  // 每百万输出 token 价格（元）
  provider: AIProvider;     // 当前选择的 AI 来源
}

export type AIProvider = "ollama" | "deepseek" | "custom" | "off";

const SETTINGS_KEY = "bookplay.ai.settings";
const USAGE_KEY = "bookplay.ai.usage";

export const DEFAULT_SETTINGS: AISettings = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  dailyBudget: 1,
  inputPricePerM: 1,
  outputPricePerM: 2,
  provider: "custom",
};

// 切换 AI 来源时自动填充的预设
export function applyProviderPreset(s: AISettings, provider: AIProvider): AISettings {
  switch (provider) {
    case "ollama":
      // 不清理 apiKey：保留用户的 DeepSeek Key，切回来时还在
      return { ...s, provider, baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" };
    case "deepseek":
      return { ...s, provider, baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" };
    case "off":
      return { ...s, provider };
    default:
      return { ...s, provider };
  }
}

export function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AISettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// 是否指向本地 Ollama（免费，无需 Key）
export function isLocalAI(): boolean {
  const s = loadSettings();
  return /localhost|127\.0\.0\.1/.test(s.baseUrl);
}

// 是否具备 AI 访问能力：有 Key，或指向本地 Ollama（无需 Key），且未被手动关闭
export function hasAIAccess(): boolean {
  const s = loadSettings();
  if (s.provider === "off") return false;
  return Boolean(s.apiKey) || isLocalAI();
}

// —— 用量统计（token + 费用，按天累积）——
interface UsageState {
  totalPrompt: number;
  totalCompletion: number;
  totalCost: number;
  days: Record<string, { prompt: number; completion: number; cost: number }>;
}

function loadUsage(): UsageState {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { totalPrompt: 0, totalCompletion: 0, totalCost: 0, days: {} };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addUsage(promptTokens: number, completionTokens: number, cost: number): void {
  const u = loadUsage();
  const k = todayKey();
  u.totalPrompt += promptTokens;
  u.totalCompletion += completionTokens;
  u.totalCost += cost;

  const d = u.days[k] ?? { prompt: 0, completion: 0, cost: 0 };
  d.prompt += promptTokens;
  d.completion += completionTokens;
  d.cost += cost;
  u.days[k] = d;

  localStorage.setItem(USAGE_KEY, JSON.stringify(u));
}

export function getUsage() {
  const u = loadUsage();
  const d = u.days[todayKey()] ?? { prompt: 0, completion: 0, cost: 0 };
  return {
    todayCost: d.cost,
    totalCost: u.totalCost,
    totalPrompt: u.totalPrompt,
    totalCompletion: u.totalCompletion,
  };
}

export function clearUsage(): void {
  localStorage.removeItem(USAGE_KEY);
}
