"use client";

export interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  onClick: () => void;
}

// 功能菜单：把所有功能集中在一个网格里，一点直达，不用到处找
export default function MenuPanel({
  onClose,
  items,
}: {
  onClose: () => void;
  items: MenuItem[];
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">功能菜单</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.onClick}
              className="rounded-xl border border-gray-200 p-3 text-left transition-colors hover:border-blue-400 dark:border-gray-700 dark:hover:border-blue-500"
            >
              <div className="text-2xl">{it.icon}</div>
              <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{it.label}</div>
              <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{it.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
