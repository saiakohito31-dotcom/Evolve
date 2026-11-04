/* Evolve — service worker. Хувилбарыг build хийх үед тэмдэглэнэ. */
const VERSION = "c75f411b87";
const CACHE = "tol-" + VERSION;
const PRECACHE = ["index.html", "manifest.webmanifest", "fonts.css", "privacy.html", "firebase-config.js", "firebase-bundle.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "badge-96.png", "favicon-32.png", "font-unbounded-cyrillic-500.woff2", "font-unbounded-cyrillic-ext-500.woff2", "font-unbounded-latin-500.woff2", "font-unbounded-cyrillic-700.woff2", "font-unbounded-cyrillic-ext-700.woff2", "font-unbounded-latin-700.woff2", "font-ibm-plex-sans-cyrillic-400.woff2", "font-ibm-plex-sans-cyrillic-ext-400.woff2", "font-ibm-plex-sans-latin-400.woff2", "font-ibm-plex-sans-cyrillic-500.woff2", "font-ibm-plex-sans-cyrillic-ext-500.woff2", "font-ibm-plex-sans-latin-500.woff2", "font-ibm-plex-sans-cyrillic-600.woff2", "font-ibm-plex-sans-cyrillic-ext-600.woff2", "font-ibm-plex-sans-latin-600.woff2", "font-jetbrains-mono-cyrillic-500.woff2", "font-jetbrains-mono-cyrillic-ext-500.woff2", "font-jetbrains-mono-latin-500.woff2", "font-caveat-cyrillic-500.woff2", "font-caveat-cyrillic-ext-500.woff2", "font-caveat-latin-500.woff2", "font-caveat-cyrillic-600.woff2", "font-caveat-cyrillic-ext-600.woff2", "font-caveat-latin-600.woff2"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // Тэсвэртэй татаж авалт: байхгүй файл (жишээ нь firebase-config.js хараахан байршуулаагүй) суулгалтыг эвдэхгүй.
    await Promise.all(PRECACHE.map(async u => {
      try {
        const r = await fetch(new Request(u, { cache: "reload" }));
        if (r && r.ok) await c.put(u, r);
      } catch (_) { /* optional file */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tol-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const NETWORK_FIRST = new Set(["firebase-config.js", "manifest.webmanifest"]);

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;              // Firebase, Google гэх мэт — шууд сүлжээгээр
  const name = url.pathname.split("/").pop();
  if (name === "sw.js") return;                              // SW-ийн шинэчлэлийг хөтөч өөрөө шалгана
  if (req.mode === "navigate" && isShell(url)) { e.respondWith(shell(e)); return; }   // зөвхөн аппын өөрийнх нь хаяг; privacy.html гэх мэт бусад хуудас энгийн кэшээр
  if (NETWORK_FIRST.has(name)) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(e));
});

// Аппын хаяг: scope-ийн root эсвэл index.html (GitHub Pages дээр /<repo>/ гэх мэт дэд хаягтай байж болно).
function isShell(url) {
  const rel = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  return rel === "" || rel === "index.html";
}

// Апп-ын бүрхүүл: кэшээс шууд нээгээд, ард нь шинэчилнэ. Кэш хоосон үед сүлжээгээр.
// Кэшэнд ҮРГЭЛЖ index.html-ийн хариуг хадгална (өөр хуудас, query-тэй хаягийн хариуг биш).
async function shell(e) {
  const c = await caches.open(CACHE);
  const hit = (await c.match("index.html")) || (await c.match("./"));
  const net = fetch("index.html", { cache: "no-cache" }).then(r => { if (r && r.ok) c.put("index.html", r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const r = await fetch(req, { cache: "no-store" });
    if (r && r.ok) c.put(req, r.clone());
    return r;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || Response.error();
  }
}

async function staleWhileRevalidate(e) {
  const c = await caches.open(CACHE);
  const hit = await c.match(e.request, { ignoreSearch: true });
  const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { await c.focus(); try { c.postMessage({ type: "open", url }); } catch (_) {} return; }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

self.addEventListener("message", e => { if (e.data && e.data.type === "skip") self.skipWaiting(); });
