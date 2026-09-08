// トレカ抽選トラッカー用のシンプルなService Worker
// アプリ本体（見た目や操作）をオフラインでも開けるようにキャッシュします。
// データそのものはlocalStorageに保存されるため、この仕組みとは別に端末内に残ります。
//
// v2: 「まずキャッシュ、無ければネット」から「まずネット、失敗したらキャッシュ」に変更。
// 前のバージョン(v1)は更新のたびに古い画面が表示され続けてしまう問題があったための修正。

const CACHE_NAME = 'tcg-lottery-tracker-v2';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 外部API(AI読み取り機能など)へのリクエストはこの仕組みの対象外。常にネットへ流す
  if (event.request.url.indexOf('api.anthropic.com') !== -1) return;

  event.respondWith(
    // まずネットワークから最新版の取得を試みる
    fetch(event.request).then((response) => {
      if (response && response.ok && event.request.url.startsWith(self.location.origin)) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // オフラインなどでネットワークが使えない時だけ、キャッシュを使う
      return caches.match(event.request);
    })
  );
});
