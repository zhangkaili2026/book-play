# 书游引擎 · BookPlay

> 阅读为主、影响为辅的互动小说网页应用。导入一本 txt，正常阅读原文；随时插入你的行动，影响剧情走向 —— **原文永不改写，影响用旁注/支线呈现**。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ 特性

- 📖 **导入即读**：拖入 txt，自动识别「第X章 / Chapter X」分章，看书 0 消耗
- 🎭 **开局选角色**：穿进已有角色或凭空捏造，锁定唯一 PC，想换角色开新存档
- ⚡ **0 token 原则**：看书、简单/中等行动走本地规则，只有复杂行动才调 AI
- 🧠 **影响层**：NPC 记忆、关系、主线偏移度，全部结构化存本地，原文永不改动
- 📋 **成长面板**：档案 / 能力 / 势力 / 履历 / 关系 / 偏移 六维侧边栏
- 💰 **消耗控制**：每次 AI 调用显示 token 与费用，可设每日预算
- 🔒 **隐私**：所有数据存浏览器本地（IndexedDB），服务器不保存任何数据，API Key 不上传
- 👥 **多用户 / 多存档**：各自数据独立，互不干扰，支持导出/导入存档换设备
- 🚀 **静态部署**：一键部署 Vercel / GitHub Pages / Netlify

## 🛠 技术栈

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zustand · Dexie.js (IndexedDB) · OpenAI 兼容 API

## 🚀 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000，导入 `samples/示例小说.txt` 即可体验完整流程。

## 🤖 配置 AI

只有「复杂行动」需要 AI。点右上角 ⚙️ 设置，两条路可选：

**方式一：本地 Ollama（免费、无需 Key、无 CORS 问题）**

1. 安装 [Ollama](https://ollama.com)，运行 `ollama run qwen2.5:7b`
2. 设置里 Base URL 填 `http://localhost:11434/v1`，模型填 `qwen2.5:7b`，API Key 留空

**方式二：DeepSeek（云服务）**

1. 到 [platform.deepseek.com](https://platform.deepseek.com) 申请 API Key
2. Base URL 填 `https://api.deepseek.com/v1`，模型 `deepseek-chat`，填入 Key

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
- 「⚙️ 设置 → 数据管理」可随时**清除所有数据**

## 📁 项目结构

```
src/
  lib/        # db(IndexedDB) / parser(分章) / actions(本地规则) / ai(调模型)
              # settings(配置) / export(导入导出) / store(Zustand 状态)
  components/ # BookImporter / Reader / CharacterCreator
              # ActionPanel / CharacterPanel / SettingsModal
  app/        # 页面与布局
```

## 🗺 路线图

- [x] txt 导入 + 章节解析
- [x] IndexedDB 存储层
- [x] 阅读层
- [x] 开局角色选择
- [x] 本地规则库（简单/中等行动，0 token）
- [x] 影响层（NPC 记忆 / 主线偏移度）
- [x] 成长面板
- [x] AI 行动判断 + 消耗控制
- [x] 存档导出 / 导入
- [ ] AI 缓存（相同行动 0 token）
- [ ] 向量情节记忆（Voy）
- [ ] URL 抓取
- [ ] 暗色模式 / 移动端完善

## 📄 License

[MIT](LICENSE)
