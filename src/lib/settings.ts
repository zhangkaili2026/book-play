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
  aiStyle: string;          // AI 反馈风格
}

export type AIProvider = "ollama" | "deepseek" | "custom" | "off";

// AI 反馈风格（影响复杂行动的回应语气）
export const AI_STYLES: { id: string; desc: string }[] = [
  { id: "原著风", desc: "模仿原著文风，庄重贴合世界观" },
  { id: "轻松风", desc: "轻松幽默，可适当玩梗" },
  { id: "严肃风", desc: "严肃克制，客观陈述" },
  { id: "吐槽风", desc: "毒舌吐槽，一针见血" },
];

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
  aiStyle: "原著风",
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

// —— 每日阅读时长 + 阅读目标 ——
const DAILY_KEY = "bookplay.dailyReading";
const GOAL_KEY = "bookplay.readingGoal";

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DailyData {
  days: Record<string, number>;
}

function loadDaily(): DailyData {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.days) return d;
    }
  } catch {
    /* ignore */
  }
  return { days: {} };
}

export function addDailyReadingSeconds(n: number): void {
  const data = loadDaily();
  const today = dateKey(new Date());
  data.days[today] = (data.days[today] ?? 0) + n;
  // 只保留最近 60 天
  const keys = Object.keys(data.days).sort();
  while (keys.length > 60) {
    delete data.days[keys.shift()!];
  }
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getTodayReadingSeconds(): number {
  const data = loadDaily();
  return data.days[dateKey(new Date())] ?? 0;
}

// 连续阅读天数（今天起往前数，读到就算）
export function getReadingStreak(): number {
  const data = loadDaily();
  let streak = 0;
  const d = new Date();
  while (true) {
    if ((data.days[dateKey(d)] ?? 0) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// 最近 N 天的阅读秒数（用于画柱状图）
export function getLastNDays(n: number): { date: string; seconds: number }[] {
  const data = loadDaily();
  const result: { date: string; seconds: number }[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    result.push({ date: key, seconds: data.days[key] ?? 0 });
  }
  return result;
}

export function getReadingGoalMinutes(): number {
  try {
    const v = localStorage.getItem(GOAL_KEY);
    if (v) return Math.max(0, Number(v) || 0);
  } catch {
    /* ignore */
  }
  return 30;
}

// —— 结局图鉴（收集达到过的结局，跨存档/跨书）——
const ENDINGS_KEY = "bookplay.endings";

export function recordEnding(label: string): void {
  try {
    const raw = localStorage.getItem(ENDINGS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(label)) list.push(label);
    localStorage.setItem(ENDINGS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function getReachedEndings(): string[] {
  try {
    const raw = localStorage.getItem(ENDINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    /* ignore */
  }
  return [];
}

export function setReadingGoalMinutes(n: number): void {
  try {
    localStorage.setItem(GOAL_KEY, String(Math.max(0, n)));
  } catch {
    /* ignore */
  }
}
