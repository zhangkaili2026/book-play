// ============================================================
// 章内滚动位置持久化（存 localStorage，刷新/切章后恢复到上次位置）
// ============================================================

const KEY = "bookplay.scrollPos";

function loadMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

export function getScrollPos(compositeKey: string): number {
  return loadMap()[compositeKey] ?? 0;
}

export function setScrollPos(compositeKey: string, pos: number): void {
  const map = loadMap();
  map[compositeKey] = Math.max(0, Math.round(pos));
  localStorage.setItem(KEY, JSON.stringify(map));
}
