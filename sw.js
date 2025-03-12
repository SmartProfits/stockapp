const CACHE_NAME = 'smartprofits-v4'; // 修改这个值会触发更新
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/s2.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js'
];

// 安装Service Worker并缓存核心资源
self.addEventListener('install', event => {
  console.log('安装新版本Service Worker: ' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('缓存已打开');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('资源缓存完成，跳过等待阶段');
        return self.skipWaiting();
      })
  );
});

// 当Service Worker被激活时，清理旧缓存
self.addEventListener('activate', event => {
  console.log('激活新版本Service Worker: ' + CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('现在使用新缓存，立即接管所有客户端');
      return self.clients.claim();
    })
  );
});

// 拦截网络请求，实现不同的缓存策略
self.addEventListener('fetch', event => {
  // 忽略 Firebase 相关请求，让它们直接走网络
  if (event.request.url.includes('firebaseio.com') || 
      event.request.url.includes('googleapis.com') || 
      event.request.url.includes('firebasestorage')) {
    return;
  }

  const url = new URL(event.request.url);
  
  // 对HTML文件使用网络优先策略
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept') && 
       event.request.headers.get('accept').includes('text/html'))) {
    console.log('对HTML请求使用网络优先策略:', url.pathname);
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // 如果从网络获取成功，更新缓存
          if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              console.log('更新HTML缓存:', url.pathname);
              cache.put(event.request, clonedResponse);
            });
          }
          return networkResponse;
        })
        .catch(error => {
          console.log('网络请求失败，使用缓存:', url.pathname, error);
          // 如果网络请求失败，尝试从缓存获取
          return caches.match(event.request);
        })
    );
  } else {
    // 对其他资源使用缓存优先策略
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // 如果在缓存中找到响应，则返回缓存
          if (response) {
            return response;
          }
          // 否则，从网络获取
          return fetch(event.request)
            .then(networkResponse => {
              // 如果获取成功，将响应复制到缓存中
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('Fetch 失败:', error);
              // 这里可以返回一个离线页面或默认响应
            });
        })
    );
  }
});

// 监听消息，处理更新通知
self.addEventListener('message', event => {
  console.log('Service Worker 收到消息:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('收到跳过等待的请求，开始激活');
    self.skipWaiting();
  }
});