// 冒烟测试：验证纯逻辑函数（不碰浏览器/数据库）
import { parseChapters } from "../src/lib/parser";
import { buildActionPrompt } from "../src/lib/ai";
import { buildCacheKey } from "../src/lib/cache";
import {
  classifyAction,
  offsetDeltaFor,
  offsetTier,
  extractTargetName,
} from "../src/lib/actions";

let pass = 0;
let fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

console.log("章节解析：");
const sample = "第一章 风起\n\n正文第一段。\n正文第二段。\n\n第二章 云涌\n\n萧炎走进了房间，环顾四周。";
const chapters = parseChapters(sample);
check("章节数 = 2", chapters.length, 2);
check("第一章标题", chapters[0].title, "第一章 风起");
check("第二章标题", chapters[1].title, "第二章 云涌");

const noCh = parseChapters("只有正文，没有章节标题。");
check("无标题 → 归入前言", noCh.length, 1);
check("前言标题", noCh[0].title, "前言");

const prefaceSentence = parseChapters("前言不搭后语，这不是章节。\n\n第一章 开始\n\n正文。");
check("前言开头的句子不算新章节", prefaceSentence.length, 2);

console.log("行动分级：");
const splitTitle = parseChapters("第一章\n风起云涌\n\n正文。\n第二章\n短句。\n\n后文。");
check("双行标题合并", splitTitle[0].title, "第一章 风起云涌");
check("双行标题保留原文", splitTitle[0].content, "风起云涌\n\n正文。");
check("正文句子不合并标题", splitTitle[1].title, "第二章");
const noBlankTitle = parseChapters("第一章\n风起云涌\n正文");
check("无空行不猜测副标题", noBlankTitle[0].title, "第一章");
check("无空行完整保留正文", noBlankTitle[0].content, "风起云涌\n正文");
check("无空行短正文不误并", parseChapters("第一章\n天亮了\n他走出房间")[0].title, "第一章");
check("相邻章节不合并", parseChapters("第一章\n第二章\n\n正文。")[0].title, "第一章");
check("简单（闲聊）", classifyAction("和萧炎闲聊"), "simple");
check("中等（结交）", classifyAction("结交纳兰嫣然"), "medium");
check("复杂（建势力）", classifyAction("建立自己的势力"), "complex");

console.log("偏移度：");
check("简单 +0", offsetDeltaFor("simple"), 0);
check("中等 +0.02", offsetDeltaFor("medium"), 0.02);
check("复杂 +0.1", offsetDeltaFor("complex"), 0.1);
check("<0.3 自由支线", offsetTier(0.1), "自由支线");
check("≥0.8 事件拉回", offsetTier(0.9), "剧情事件拉回");

console.log("对象名提取：");
check("结交→纳兰嫣然", extractTargetName("结交纳兰嫣然"), "纳兰嫣然");

const cacheInput = { model: "model", saveId: 1, pcName: "角色", chapterIndex: 0, action: "观察" };
check("缓存键区分分隔符与行动边界",
  buildCacheKey({ ...cacheInput, recentActions: ["a|b", "c"] }) ===
  buildCacheKey({ ...cacheInput, recentActions: ["a", "b|c"] }), false);
const prompt = buildActionPrompt({
  pc: { name: "角色", identity: "旅人", faction: "无", abilities: [], power: "无", resources: [] },
  chapterTitle: "第一章", recentActions: ["一", "二", "三", "四", "五", "第六条行动"], action: "观察",
});
check("提示词最多包含五条行动", prompt[1].content.includes("第六条行动"), false);

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
