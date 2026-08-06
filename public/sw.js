// Kill switch: this app no longer uses a service worker.
// Any previously-installed service worker will fetch this file
// (served with no-store/no-cache), activate, wipe every cache it
// created, unregister itself, and reload open tabs so the network
// is used normally again — including for old browsers that still
// have the old Workbox precache-everything-for-24h version active.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => client.navigate(client.url));
    })()
  );
});
