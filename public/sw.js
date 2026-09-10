/**
 * A service worker whose only job is to remove itself.
 *
 * scrlpets.com previously served a Vite/Workbox PWA that registered a worker
 * here, at scope "/". A service worker outlives the site it came from: after
 * the domain was pointed at v2, returning visitors kept being served the OLD
 * app from its precache, including a Supabase cache aimed at the legacy
 * project. Deleting the file did not help — a 404 on the update check is
 * treated as a failed check, not as a signal to unregister, so the stale
 * worker stays in control indefinitely.
 *
 * The only fix that reaches a browser already in that state is a real worker
 * at the same path that tears itself down. Hence this file.
 *
 * v2 has no service worker of its own. If one is ever added it MUST NOT live
 * at this path until every affected browser has been through this, because
 * replacing this with a caching worker would strand exactly the people it was
 * written for.
 *
 * Deliberately plain ES5-ish and dependency-free: it has to parse in whatever
 * browser is stuck, which is by definition one that has not loaded v2's code.
 */

// Take over without waiting for the old worker's clients to close. The point is
// to stop serving the stale app as soon as possible, not politely eventually.
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      // The precache is the stale app. Leaving it behind would keep the old
      // assets on disk and, with them, the ability to serve them again.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      await self.registration.unregister();

      // Reload every open tab so the person sees the real site now rather than
      // on some future navigation. Without this they sit on the stale render
      // until they happen to click something.
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })(),
  );
});
