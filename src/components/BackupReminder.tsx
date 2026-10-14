"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { shouldRemindBackup } from "@/lib/settings";
import { useStore } from "@/lib/store";

export default function BackupReminder() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const exporting = useRef(false);
  useEffect(() => {
    let cancelled = false;
    db.saves.count().then(count => {
      if (!cancelled) setVisible(count > 0 && shouldRemindBackup());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function backup() {
    if (exporting.current) return;
    exporting.current = true;
    setBusy(true);
    setError("");
    try {
      if (useStore.getState().currentSaveId == null) {
        const save = await db.saves.orderBy("createdAt").reverse().first();
        if (!save) { setVisible(false); return; }
        await useStore.getState().openBook(save.bookId);
        await useStore.getState().switchSave(save.id!);
      }
      await useStore.getState().exportSaveBackup();
      if (shouldRemindBackup()) throw new Error("存档未能导出，请选择有效存档后重试。");
      setVisible(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "备份失败，请重试。");
    } finally {
      exporting.current = false;
      setBusy(false);
    }
  }

  if (!visible) return null;
  return (
    <aside role="status" className="fixed inset-x-0 top-16 z-50 mx-auto w-[92%] max-w-md rounded-xl border border-blue-200 bg-white p-3 text-sm text-gray-800 shadow-lg dark:border-blue-800 dark:bg-gray-900 dark:text-gray-100">
      <p>💾 建议备份存档</p>
      <p className="mt-1 text-xs text-gray-500">将当前存档下载到本机；未选存档时备份最近的存档。</p>
      {error && <p className="mt-2 text-red-500">{error}</p>}
      <div className="mt-2 flex gap-3">
        <button disabled={busy} onClick={backup} className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50">{busy ? "备份中…" : "立即备份"}</button>
        <button disabled={busy} onClick={() => {
          try { localStorage.setItem("bookplay.backupRemindDismissedAt", String(Date.now())); } catch { /* storage unavailable */ }
          setVisible(false);
        }}>稍后</button>
      </div>
    </aside>
  );
}
