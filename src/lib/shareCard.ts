// ============================================================
// 分享卡片：用 Canvas 把「我的书游记录」画成一张图，下载为 PNG。
// 支持多套主题（默认/修仙风/权谋风/暗黑风）。纯本地、0 token。
// ============================================================

export interface ShareCardData {
  pcName: string;
  bookTitle: string;
  ending: { label: string; desc: string };
  offset: number;
  offsetTier: string;
  actionCount: number;
  complexCount: number;
  npcCount: number;
  level: number;
  complexActions: { chapterIndex: number; content: string }[];
}

export type ShareTheme = "默认" | "修仙风" | "权谋风" | "暗黑风";

const THEMES: Record<ShareTheme, { bg: string; accent: string; title: string; text: string; muted: string }> = {
  默认: { bg: "#faf6ef", accent: "#3b82f6", title: "#1f2937", text: "#374151", muted: "#9ca3af" },
  修仙风: { bg: "#eef5ff", accent: "#6366f1", title: "#1e293b", text: "#334155", muted: "#94a3b8" },
  权谋风: { bg: "#1c1917", accent: "#d4a017", title: "#f5f5f4", text: "#d6d3d1", muted: "#a8a29e" },
  暗黑风: { bg: "#0a0a0a", accent: "#dc2626", title: "#fafafa", text: "#d4d4d4", muted: "#737373" },
};

export function generateShareCard(data: ShareCardData, theme: ShareTheme = "默认"): void {
  const w = 600;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;

  const t = THEMES[theme] ?? THEMES["默认"];

  const font = (size: number, bold = false) =>
    `${bold ? "bold " : ""}${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;

  // 背景
  c.fillStyle = t.bg;
  c.fillRect(0, 0, w, h);
  c.fillStyle = t.accent;
  c.fillRect(0, 0, w, 8);

  c.textBaseline = "top";
  let y = 48;

  c.fillStyle = t.title;
  c.font = font(32, true);
  c.fillText("我的书游记录", 48, y);
  y += 52;

  c.fillStyle = t.muted;
  c.font = font(18);
  c.fillText(`${data.pcName} · 《${data.bookTitle}》`, 48, y);
  y += 44;

  c.strokeStyle = t.muted;
  c.beginPath();
  c.moveTo(48, y);
  c.lineTo(w - 48, y);
  c.stroke();
  y += 36;

  c.fillStyle = t.title;
  c.font = font(22, true);
  c.fillText(`🎬 ${data.ending.label}`, 48, y);
  y += 36;
  c.fillStyle = t.muted;
  c.font = font(15);
  c.fillText(data.ending.desc, 48, y);
  y += 56;

  c.fillStyle = t.text;
  c.font = font(16);
  const stats = [
    `偏移度：${data.offset.toFixed(2)}（${data.offsetTier}）`,
    `行动：${data.actionCount} 次（复杂 ${data.complexCount} 次）`,
    `关系角色：${data.npcCount} · 等级 Lv.${data.level}`,
  ];
  for (const s of stats) {
    c.fillText(s, 48, y);
    y += 30;
  }
  y += 24;

  c.fillStyle = t.title;
  c.font = font(18, true);
  c.fillText("大事记", 48, y);
  y += 36;
  c.fillStyle = t.text;
  c.font = font(15);
  const top = data.complexActions.slice(0, 5);
  if (top.length) {
    for (const a of top) {
      const raw = `第${a.chapterIndex + 1}章「${a.content}」`;
      const text = raw.length > 22 ? raw.slice(0, 22) + "…" : raw;
      c.fillText(`· ${text}`, 48, y);
      y += 28;
    }
  } else {
    c.fillText("· 暂无复杂行动", 48, y);
  }

  c.fillStyle = t.muted;
  c.font = font(13);
  c.fillText("书游引擎 · 阅读为主，影响为辅", 48, h - 44);

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "我的书游记录.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
