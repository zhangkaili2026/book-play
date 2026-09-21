// ============================================================
// 章节解析器：把整个 txt 字符串按章节标题拆成 [{title, content}]。
// 纯函数：不碰 AI、不碰数据库，方便单独测试。
// ============================================================

export interface ParsedChapter {
  title: string;
  content: string;
}

// 中文章节形态：第X章/第X回/第X卷/第X节/第X集/第X部/第X篇
// + 英文 Chapter X + 序章/楔子/尾声等特殊章
const CHAPTER_TITLE_RE =
  /^\s*(第[零一二三四五六七八九十百千万0-9]+[章节回卷集部篇]|Chapter\s+\d+|序章|序言|楔子|前言|引子|尾声|后记|番外).*/i;

export function isChapterTitle(line: string): boolean {
  return CHAPTER_TITLE_RE.test(line.trim());
}

export function parseChapters(raw: string): ParsedChapter[] {
  const lines = raw.split(/\r?\n/);
  const chapters: ParsedChapter[] = [];
  let current: ParsedChapter | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (isChapterTitle(trimmed)) {
      // 遇到新标题：先把上一章收尾，再开新章
      if (current) chapters.push(current);
      current = { title: trimmed, content: "" };
    } else if (current) {
      // 正文：保留原始换行（包括空行，用于分段/场景切换）
      current.content += line + "\n";
    } else if (trimmed !== "") {
      // 第一个章节标题之前的内容（书名、简介等）归入"前言"
      current = { title: "前言", content: line + "\n" };
    }
  }

  if (current) chapters.push(current);
  return chapters;
}

// 已知局限：像 "第一章\n风起云涌" 这种标题和名字分两行的写法，
// 目前会把 "风起云涌" 当成正文第一行。后续可加"短标题回看合并"来修。
