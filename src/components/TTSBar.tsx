"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

const SPEEDS = [0.5, 1, 1.5, 2];
const TIMERS = [0, 15, 30, 60];

// 听书栏：用浏览器 Web Speech API 朗读原文（免费，0 token）
export default function TTSBar() {
  const currentContent = useStore((s) => s.currentContent);

  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timerMin, setTimerMin] = useState(0);
  const [paraIndex, setParaIndex] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");

  const activeRef = useRef(false);
  const speedRef = useRef(1);
  const paraIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  function stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    activeRef.current = false;
    setActive(false);
    setPaused(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  // 朗读第 index 段；读完后自动下一段，章节结束则自动下一章
  function speakPara(index: number) {
    if (!activeRef.current) return;
    const st = useStore.getState();
    const paras = st.currentContent.split("\n").filter((p) => p.trim() !== "");

    if (index >= paras.length) {
      if (st.currentChapterIndex + 1 < st.chapterList.length) {
        st.gotoChapter(st.currentChapterIndex + 1); // 触发 content 变化 → effect 重读新章
      } else {
        stop();
      }
      return;
    }

    paraIndexRef.current = index;
    setParaIndex(index);

    const u = new SpeechSynthesisUtterance(paras[index]);
    u.lang = "zh-CN";
    u.rate = speedRef.current;
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = () => speakPara(index + 1);
    window.speechSynthesis.speak(u);
  }

  function start() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    activeRef.current = true;
    speedRef.current = speed;
    paraIndexRef.current = 0;
    setActive(true);
    setPaused(false);
    speakPara(0);
    if (timerMin > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(stop, timerMin * 60 * 1000);
    }
  }

  function pause() {
    window.speechSynthesis.pause();
    setPaused(true);
  }

  function resume() {
    window.speechSynthesis.resume();
    setPaused(false);
  }

  function changeSpeed(v: number) {
    speedRef.current = v;
    setSpeed(v);
    // 变速：从当前段重新读（应用新速度）
    if (activeRef.current) {
      window.speechSynthesis.cancel();
      speakPara(paraIndexRef.current);
    }
  }

  // 章节变化时，若正在播放，从头读新章
  useEffect(() => {
    if (activeRef.current) {
      window.speechSynthesis.cancel();
      paraIndexRef.current = 0;
      speakPara(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContent]);

  // 加载中文音色
  useEffect(() => {
    function loadVoices() {
      const vs = window.speechSynthesis
        .getVoices()
        .filter((v) => v.lang.toLowerCase().startsWith("zh"));
      setVoices(vs);
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // 卸载时停止
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!supported) return null;

  const paras = currentContent.split("\n").filter((p) => p.trim() !== "");

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-900">
      {!active ? (
        <button
          onClick={start}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          🎧 听书
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            onClick={paused ? resume : pause}
            className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
          >
            {paused ? "▶ 继续" : "⏸ 暂停"}
          </button>
          <button
            onClick={stop}
            className="rounded border border-gray-300 px-3 py-1 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ⏹ 停止
          </button>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">倍速</span>
            {SPEEDS.map((v) => (
              <button
                key={v}
                onClick={() => changeSpeed(v)}
                className={`rounded px-2 py-0.5 text-xs ${
                  speed === v
                    ? "bg-blue-100 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {v}x
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">定时</span>
            {TIMERS.map((v) => (
              <button
                key={v}
                onClick={() => setTimerMin(v)}
                className={`rounded px-2 py-0.5 text-xs ${
                  timerMin === v
                    ? "bg-blue-100 font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                {v === 0 ? "关" : `${v}分`}
              </button>
            ))}
          </div>

          {voices.length > 0 && (
            <select
              value={voiceName}
              onChange={(e) => {
                const v = voices.find((x) => x.name === e.target.value) ?? null;
                voiceRef.current = v;
                setVoiceName(e.target.value);
              }}
              className="rounded border border-gray-300 bg-white px-1 py-0.5 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="">默认音色</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          )}

          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            第 {paraIndex + 1} / {paras.length} 段
          </span>
        </div>
      )}
    </div>
  );
}
