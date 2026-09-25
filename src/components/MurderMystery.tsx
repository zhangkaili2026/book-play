"use client";

import { useState } from "react";
import {
  MYSTERY_SCRIPTS,
  type MysteryScript,
  type MysteryCharacter,
} from "@/lib/murder";
import { callLLM } from "@/lib/ai";
import { hasAIAccess } from "@/lib/settings";

type Tab = "roles" | "clues" | "chat" | "accuse";

function buildChatPrompt(
  script: MysteryScript,
  char: MysteryCharacter,
  question: string,
  history: { role: "me" | "npc"; text: string }[]
) {
  const system = [
    `你是剧本杀《${script.title}》中的角色「${char.name}」（${char.identity}）。`,
    `故事背景：${script.background}`,
    `你的秘密：${char.secret}`,
    `你的隐藏任务：${char.task}`,
    "规则：以这个角色的身份回答玩家提问。可以隐瞒、可以撒谎，但不要主动说出自己的秘密，除非被逼到绝路。用第一人称，回答 2~4 句话。",
  ].join("\n");
  const hist = history
    .slice(-6)
    .map((m) => `${m.role === "me" ? "玩家" : char.name}：${m.text}`)
    .join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `${hist ? hist + "\n" : ""}玩家：${question}` },
  ];
}

// 剧本杀（单人模式）
export default function MurderMystery({ onClose }: { onClose: () => void }) {
  const [script, setScript] = useState<MysteryScript | null>(null);
  const [myChar, setMyChar] = useState<MysteryCharacter | null>(null);
  const [tab, setTab] = useState<Tab>("roles");
  const [chatChar, setChatChar] = useState<MysteryCharacter | null>(null);
  const [chat, setChat] = useState<{ role: "me" | "npc"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [accused, setAccused] = useState<string | null>(null);

  const card = "rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
  const btn = "rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40";

  async function sendChat() {
    if (!script || !chatChar || !chatInput.trim()) return;
    const q = chatInput.trim();
    setChat((c) => [...c, { role: "me", text: q }]);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await callLLM(buildChatPrompt(script, chatChar, q, chat));
      setChat((c) => [...c, { role: "npc", text: res.content }]);
    } catch (e) {
      setChat((c) => [...c, { role: "npc", text: `（AI 出错：${(e as Error).message}）` }]);
    } finally {
      setChatBusy(false);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "roles", label: "角色" },
    { key: "clues", label: "线索" },
    { key: "chat", label: "对话" },
    { key: "accuse", label: "指认" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <span className="font-bold text-gray-900 dark:text-gray-100">🎭 剧本杀</span>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-4">
          {/* 选剧本 */}
          {!script && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-gray-100">选择剧本</h2>
              <div className="space-y-3">
                {MYSTERY_SCRIPTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScript(s)}
                    className={`${card} block w-full text-left hover:border-blue-400`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{s.title}</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{s.background}</div>
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {s.characters.length} 名角色 · {s.clues.length} 条线索
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 选角色 */}
          {script && !myChar && (
            <div>
              <h2 className="mb-1 text-lg font-bold text-gray-900 dark:text-gray-100">选择你的角色</h2>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                每个角色都有不为人知的秘密和隐藏任务，选定后你就是「他」。
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {script.characters.map((ch) => (
                  <button
                    key={ch.name}
                    onClick={() => {
                      setMyChar(ch);
                      setChatChar(ch);
                      setChat([]);
                    }}
                    className={`${card} block text-left hover:border-blue-400`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {ch.name} · {ch.identity}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ch.publicInfo}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 游戏界面 */}
          {script && myChar && (
            <div>
              {/* 我的角色卡 */}
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <div className="font-medium text-blue-800 dark:text-blue-200">
                  你扮演：{myChar.name}（{myChar.identity}）
                </div>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-medium">你的秘密：</span>
                  {myChar.secret}
                </div>
                <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-medium">隐藏任务：</span>
                  {myChar.task}
                </div>
              </div>

              {/* 标签页 */}
              <div className="mb-4 flex border-b border-gray-200 dark:border-gray-700">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-3 py-2 text-sm ${
                      tab === t.key
                        ? "border-b-2 border-blue-600 font-medium text-blue-600 dark:border-blue-400 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* 角色 */}
              {tab === "roles" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {script.characters.map((ch) => (
                    <div key={ch.name} className={card}>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {ch.name} · {ch.identity}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{ch.publicInfo}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 线索 */}
              {tab === "clues" && (
                <div className="space-y-3">
                  {script.clues.map((cl) => (
                    <div key={cl.id} className={card}>
                      <div className="font-medium text-gray-900 dark:text-gray-100">🔍 {cl.name}</div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{cl.desc}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 对话 */}
              {tab === "chat" && (
                <div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {script.characters.map((ch) => (
                      <button
                        key={ch.name}
                        onClick={() => {
                          setChatChar(ch);
                          setChat([]);
                        }}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          chatChar?.name === ch.name
                            ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300"
                            : "border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>

                  <div className={`${card} min-h-40`}>
                    <div className="space-y-2 text-sm">
                      {chat.length === 0 && (
                        <p className="text-gray-400 dark:text-gray-500">
                          选择上方一个角色，开始盘问。AI 会扮演 Ta 回答你。
                        </p>
                      )}
                      {chat.map((m, i) => (
                        <div key={i} className={m.role === "me" ? "text-right" : ""}>
                          <span
                            className={`inline-block max-w-[85%] rounded-lg px-3 py-1.5 ${
                              m.role === "me"
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {m.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {!hasAIAccess() ? (
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      需要先配置 AI（⚙️ 设置里选本地 Ollama 或 DeepSeek）才能和角色对话。
                    </p>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat()}
                        placeholder={`问 ${chatChar?.name ?? "角色"} 一个问题…`}
                        className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                      />
                      <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()} className={btn}>
                        {chatBusy ? "…" : "发送"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 指认 */}
              {tab === "accuse" && (
                <div>
                  <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                    真相只有一个。指认你认为是凶手的人：
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {script.characters.map((ch) => (
                      <button
                        key={ch.name}
                        onClick={() => setAccused(ch.name)}
                        disabled={accused != null}
                        className={`${card} block text-left ${
                          accused === ch.name ? "border-red-400" : "hover:border-blue-400"
                        }`}
                      >
                        {ch.name} · {ch.identity}
                      </button>
                    ))}
                  </div>

                  {accused && (
                    <div
                      className={`mt-4 rounded-xl p-4 ${
                        accused === script.culprit
                          ? "border border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
                          : "border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {accused === script.culprit ? "✅ 你指认对了！" : "❌ 你指认错了。"}
                      </div>
                      <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{script.truth}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
