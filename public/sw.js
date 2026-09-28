// ============================================================
// Service Worker：让应用可离线打开 + 被浏览器识别为"可安装 PWA"
//
// 缓存策略（按请求类型区分，避免旧文件卡缓存）：
//   - 页面导航（navigate）：网络优先，失败回退缓存（在线拿最新，离线也能打开）
//   - 构建产物 /_next/static/*（文件名带哈希、内容不变）：缓存优先，二次访问秒开
//   - 其余同源资源（manifest.json、图标、favicon 等）：网络优先，失败回退缓存
//   - 跨域请求（比如 AI 接口）：不拦截
//
// 更新说明：改代码后请把 CACHE 名字里的 v1 改成 v2/v3…，旧的缓存会自动清掉。
// ============================================================

const CACHE = "bookplay-v1";

// 安装：跳过等待，直接接管
self.addEventListener("install", () => {
  self.skipWaiting();
});

// 激活：清理旧版本缓存，并立即接管已打开的页面
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 只处理读请求

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨域（AI 等）不动

  // 1) 页面导航：网络优先，离线时回退缓存（首页）
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => {
            if (hit) return hit;
            // 兜底：找缓存的首页（相对 SW 自身路径解析，兼容 /book-play/ 子路径）
            return caches.match(new URL("./", self.location.href).href);
          })
        )
    );
    return;
  }

  // 2) 构建产物（文件名带哈希，内容不变）：缓存优先
  if (url.pathname.includes("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // 3) 其余同源资源（manifest / 图标 / favicon 等）：网络优先，失败回退缓存
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
