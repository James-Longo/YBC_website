// Minimal service worker so browsers treat the site as an installable app.
// It intentionally caches nothing, so the site always loads live.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
