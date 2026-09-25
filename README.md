# 书游引擎 · BookPlay

> 阅读为主、影响为辅的互动小说网页应用。导入一本 txt，正常阅读原文；随时插入你的行动，影响剧情走向 —— **原文永不改写，影响用旁注/支线呈现**。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 特性

- 📖 **导入即读**：拖入 txt 自动分章（UTF-8 / GBK 都能识别），看书 0 消耗
- 🎭 **开局选角色**：AI 分析书籍类型、生成符合世界观的 3 个身份；锁定唯一 PC，换角色开新存档
- ⚡ **0 token 原则**：看书、简单/中等行动走本地规则，只有复杂行动才调 AI（带缓存）
- 🧠 **影响层**：NPC 记忆、关系、主线偏移度，结构化存本地，原文永不改动
- 📌 **旁注 + 影响面板**：行动锚定到正文，点图标在侧边面板看影响
- 📋 **成长面板**：档案 / 能力 / 势力 / 履历 / 关系 / 偏移 / 系统 七维侧边栏
- 🎮 **系统面板**：经验值、等级、点数兑换（全本地 0 token）
- 💾 **存档点**：手动存档 + 每章自动存档，玩崩了随时读档回退
- 💰 **消耗控制**：显示 token 与费用、每日预算、相同行动走缓存
- 🔒 **隐私**：数据存浏览器本地，服务器零存储，API Key 不上传
- 🔍 **正文搜索**：全文搜索，点结果跳转章节
- 📊 **阅读统计**：章节进度、行动次数、偏移度趋势曲线
- 🎧 **听书模式**：浏览器朗读原文，倍速 / 定时 / 连播
- 🎬 **多结局 + 报告 + 分享卡片**：判定结局、生成报告、一键出图分享
- 🎭 **剧本杀（单人）**：AI 扮演角色，搜证对话指认真凶
- 🎯 **名场面 / 意难平 / 回响 / 沉浸**：读得更沉浸、更有回音
- ✏️ **划线批注 + 书签**：边读边划、标记章节
- ⏱️ **阅读时长 / 目标打卡**：统计阅读时长，设每日目标
- 📱 **多端适配**：电脑手机都能用，暗色模式，各自数据独立
- 🚀 **静态部署**：一键部署 Vercel / GitHub Pages / Netlify

## 🛠 技术栈

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zustand · Dexie.js (IndexedDB) · OpenAI 兼容 API

## 🚀 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000，导入 `samples/示例小说.txt` 即可体验完整流程。

> 📖 完整使用说明（含 AI 接入、数据隐私、常见问题）见 **[使用说明.md](使用说明.md)**。

## 🤖 配置 AI

「复杂行动」和「开局身份生成」需要 AI。点右上角 ⚙️，顶部有 **4 个「AI 来源」按钮一键切换**：🖥️ 本地 Ollama（免费）/ ☁️ DeepSeek（云）/ 🔧 自定义 / ⛔ 关闭 AI，切换时自动填充接口地址和模型，并显示当前状态（本地免费 / 云计费 / 已关闭）。

**本地 Ollama（免费、无需 Key）**

1. 安装 [Ollama](https://ollama.com)，运行 `ollama pull qwen2.5:7b`
2. ⚙️ 点「本地 Ollama」→ 保存

**DeepSeek（云服务）**

1. 到 [platform.deepseek.com](https://platform.deepseek.com) 申请 API Key
2. ⚙️ 点「DeepSeek」→ 填 Key → 保存

> ⚠️ API Key 只存在你浏览器 localStorage，**绝不上传服务器**。部分云服务商禁止浏览器直连（CORS 限制），如遇此问题请改用本地 Ollama 或自建代理。

## 📦 部署

构建静态文件：

```bash
npm run build   # 产物在 out/ 目录
```

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/你的仓库名)

或手动：把仓库推送到 GitHub → 在 [vercel.com](https://vercel.com) 导入仓库 → 自动识别 Next.js 并部署。

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/你的用户名/你的仓库名)

或手动：Netlify 导入仓库，构建命令 `npm run build`，发布目录 `out`（已配好 [netlify.toml](netlify.toml)）。

### GitHub Pages

1. 若部署到 `用户名.github.io/仓库名/`（子路径），打开 [next.config.mjs](next.config.mjs) 取消 `basePath` 注释
2. 推送仓库 → GitHub 仓库 Settings → Pages → Source 选 GitHub Actions 或 `out` 目录

> 部署到网上后，**每个访客的数据只存在自己的浏览器里**，服务器不保存任何用户数据。

## 🔒 数据与隐私

- 所有数据存浏览器 IndexedDB（Dexie.js），服务器零存储
- API Key 存浏览器 localStorage，绝不上传
- 自动清理无主的孤儿数据，保持数据干净
- 「⚙️ 设置 → 数据管理」可随时**清除所有数据**

## 📁 项目结构

```
src/
  lib/        # db(IndexedDB) / parser(分章) / actions(本地规则) / ai(调模型)
              # settings(配置) / export(导入导出) / system(经验兑换) / cache(AI缓存) / store(状态)
  components/ # BookImporter / Reader / CharacterCreator / ActionPanel
              # CharacterPanel / ImpactPanel / TocPanel / SavePanel / SettingsModal
  app/        # 页面与布局
```

## 🗺 路线图

- [x] txt 导入 + 章节解析（UTF-8 / GBK）
- [x] IndexedDB 存储层
- [x] 阅读层
- [x] 开局角色选择 + AI 身份动态生成
- [x] 本地规则库（简单/中等行动，0 token）
- [x] 影响层（NPC 记忆 / 主线偏移度）
- [x] 旁注 inline + 影响面板
- [x] 成长面板（七维）
- [x] 系统面板（经验 / 点数 / 兑换）
- [x] 存档点（手动 + 自动 + 读档）
- [x] AI 行动判断 + 消耗控制 + 缓存
- [x] 存档导出 / 导入
- [x] 暗色模式 / 移动端完善
- [x] 正文搜索
- [x] 阅读统计 / 偏移度曲线
- [x] 听书模式
- [x] 系统商城动态化 + 提醒
- [x] 沉浸模式 / 翻页过渡
- [x] 影响回响系统
- [x] 名场面标记 / 意难平清单
- [x] 多结局 / 玩后报告 / 分享卡片
- [x] 剧本杀（单人）
- [x] 划线批注 / 书签
- [x] 阅读时长 / 目标打卡
- [ ] 向量情节记忆（Voy）
- [ ] URL 抓取

## 📄 License

[MIT](LICENSE)
