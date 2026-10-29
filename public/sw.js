// Poker Summit service worker (2026/10/28). Makes the site installable as an app ("ホーム画面に追加").
// It does not cache or intercept pages: every request goes to the network as before.
// Push notifications will be added here later.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
