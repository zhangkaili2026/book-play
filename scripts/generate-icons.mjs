// ============================================================
// 生成 PWA 图标（不需要任何第三方依赖，纯 Node 手写 PNG 编码）
//
// 用法：node scripts/generate-icons.mjs
// 输出到 public/icons/：
//   icon-192.png       192x192  普通图标（圆角，四角透明）
//   icon-512.png       512x512  普通图标（圆角，四角透明）
//   maskable-512.png   512x512  maskable（满出血，适配 Android 圆形遮罩）
//   apple-touch-icon.png 180x180 iOS 主屏图标（满出血，iOS 自己切圆角）
//
// 设计：靛蓝底 + 白色书本 + 右下角琥珀色播放角标（书 + 游）
// ============================================================

import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

// —— 配色 ——
const BRAND = [79, 70, 229];        // #4F46E5 主色（靛蓝）
const BRAND_DARK = [55, 48, 163];   // #3730A3 书脊深色
const WHITE = [255, 255, 255];
const AMBER = [245, 158, 11];       // #F59E0B 播放角标

// —— 书本几何（归一化 0~1 坐标）——
const BOOK_CX = 0.5, BOOK_CY = 0.5;
const BOOK_HW = 0.20, BOOK_HH = 0.125, BOOK_R = 0.028; // 白封皮
const SPINE_W = 0.075;                                  // 左侧书脊宽
const GUTTER_X = BOOK_CX - BOOK_HW + SPINE_W;           // 书脊与封皮分界

// —— 播放角标 ——
const BADGE_CX = 0.71, BADGE_CY = 0.71, BADGE_R = 0.10;

// —— 基础图形：圆角矩形 / 圆 的符号距离函数（SDF）——
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}
// 点是否在三角形内（用于播放三角）
function sign(px, py, p1, p2) {
  return (px - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (py - p2[1]);
}
function inTriangle(px, py, a, b, c) {
  const d1 = sign(px, py, a, b), d2 = sign(px, py, b, c), d3 = sign(px, py, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// 返回某归一化坐标处的颜色 [r,g,b,a]（a 要么 255 要么 0，便于抗锯齿平均）
function design(nx, ny, rounded) {
  // 背景：rounded=true 时画圆角（四角留透明），否则满出血
  const bgR = rounded ? 0.22 : 0.0;
  if (sdRoundRect(nx, ny, 0.5, 0.5, 0.5, 0.5, bgR) > 0) return [0, 0, 0, 0];

  let out = [...BRAND, 255]; // 底色

  // 白封皮
  if (sdRoundRect(nx, ny, BOOK_CX, BOOK_CY, BOOK_HW, BOOK_HH, BOOK_R) <= 0) out = [...WHITE, 255];
  // 书脊（左侧深色）
  if (sdRoundRect(nx, ny, BOOK_CX - BOOK_HW + SPINE_W / 2, BOOK_CY, SPINE_W / 2, BOOK_HH, BOOK_R * 0.7) <= 0) out = [...BRAND_DARK, 255];
  // 书脊与封皮的分界细线
  if (sdRoundRect(nx, ny, GUTTER_X, BOOK_CY, 0.006, BOOK_HH - 0.025, 0.003) <= 0) out = [...BRAND, 255];
  // 封皮上的两行"标题"横条
  if (sdRoundRect(nx, ny, 0.53, 0.465, 0.115, 0.016, 0.008) <= 0) out = [...BRAND, 255];
  if (sdRoundRect(nx, ny, 0.50, 0.535, 0.085, 0.016, 0.008) <= 0) out = [...BRAND, 255];

  // 右下角播放角标：琥珀圆 + 白色播放三角
  if (sdCircle(nx, ny, BADGE_CX, BADGE_CY, BADGE_R) <= 0) {
    out = [...AMBER, 255];
    const tri = [
      [BADGE_CX - 0.045, BADGE_CY - 0.055],
      [BADGE_CX - 0.045, BADGE_CY + 0.055],
      [BADGE_CX + 0.055, BADGE_CY],
    ];
    if (inTriangle(nx, ny, tri[0], tri[1], tri[2])) out = [...WHITE, 255];
  }

  return out;
}

// 4x4 超采样抗锯齿，渲染一张 size x size 的 RGBA
function render(size, rounded) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4, N = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          const [cr, cg, cb, ca] = design(nx, ny, rounded);
          if (ca > 0) { r += cr; g += cg; b += cb; hit++; }
        }
      }
      const idx = (y * size + x) * 4;
      if (hit === 0) {
        buf[idx] = buf[idx + 1] = buf[idx + 2] = buf[idx + 3] = 0;
      } else {
        buf[idx] = Math.round(r / hit);
        buf[idx + 1] = Math.round(g / hit);
        buf[idx + 2] = Math.round(b / hit);
        buf[idx + 3] = Math.round((hit / N) * 255);
      }
    }
  }
  return buf;
}

// —— 最小 PNG 编码器（RGBA，无损）——
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 6; // 颜色类型 6 = RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // 每行 filter 字节 = 0（无过滤）
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// —— 生成各尺寸 ——
mkdirSync(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, true],
  ["icon-512.png", 512, true],
  ["maskable-512.png", 512, false],
  ["apple-touch-icon.png", 180, false],
];
for (const [name, size, rounded] of targets) {
  const png = encodePNG(size, render(size, rounded));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`✓ ${name} (${size}x${size})`);
}
console.log("图标已生成到 public/icons/");
