// 冒烟测试：验证纯逻辑函数（不碰浏览器/数据库）
import { parseChapters } from "../src/lib/parser";
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

console.log("行动分级：");
check("简单（闲聊）", classifyAction("和萧炎闲聊"), "simple");
check("中等（结交）", classifyAction("结交纳兰嫣然"), "medium");
check("复杂（建势力）", classifyAction("建立自己的势力"), "complex");

console.log("偏移度：");
check("简单 +0", offsetDeltaFor("simple"), 0);
check("中等 +0.05", offsetDeltaFor("medium"), 0.05);
check("复杂 +0.2", offsetDeltaFor("complex"), 0.2);
check("<0.3 自由支线", offsetTier(0.1), "自由支线");
check("≥0.8 事件拉回", offsetTier(0.9), "剧情事件拉回");

console.log("对象名提取：");
check("结交→纳兰嫣然", extractTargetName("结交纳兰嫣然"), "纳兰嫣然");

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
