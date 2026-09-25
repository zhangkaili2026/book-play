// ============================================================
// 分享卡片：用 Canvas 把「我的书游记录」画成一张图，下载为 PNG。
// 纯本地、0 token。
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

export function generateShareCard(data: ShareCardData): void {
  const w = 600;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (!c) return;

  const font = (size: number, bold = false) =>
    `${bold ? "bold " : ""}${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;

  // 背景
  c.fillStyle = "#faf6ef";
  c.fillRect(0, 0, w, h);
  // 顶部蓝色装饰条
  c.fillStyle = "#3b82f6";
  c.fillRect(0, 0, w, 8);

  c.textBaseline = "top";
  let y = 48;

  // 标题
  c.fillStyle = "#1f2937";
  c.font = font(32, true);
  c.fillText("我的书游记录", 48, y);
  y += 52;

  // 副标题
  c.fillStyle = "#6b7280";
  c.font = font(18);
  c.fillText(`${data.pcName} · 《${data.bookTitle}》`, 48, y);
  y += 44;

  // 分隔线
  c.strokeStyle = "#d1d5db";
  c.beginPath();
  c.moveTo(48, y);
  c.lineTo(w - 48, y);
  c.stroke();
  y += 36;

  // 结局
  c.fillStyle = "#1f2937";
  c.font = font(22, true);
  c.fillText(`🎬 ${data.ending.label}`, 48, y);
  y += 36;
  c.fillStyle = "#6b7280";
  c.font = font(15);
  c.fillText(data.ending.desc, 48, y);
  y += 56;

  // 统计
  c.fillStyle = "#1f2937";
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

  // 大事记
  c.fillStyle = "#1f2937";
  c.font = font(18, true);
  c.fillText("大事记", 48, y);
  y += 36;
  c.fillStyle = "#374151";
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

  // 底部
  c.fillStyle = "#9ca3af";
  c.font = font(13);
  c.fillText("书游引擎 · 阅读为主，影响为辅", 48, h - 44);

  // 下载
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = "我的书游记录.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
