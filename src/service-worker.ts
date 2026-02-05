/// <reference lib="webworker" />

/* eslint-disable compat/compat */
/* eslint-disable sonarjs/no-implicit-dependencies */
/* eslint-disable sonarjs/arrow-function-convention */

import { build, files, version } from "$service-worker";

declare const self: ServiceWorkerGlobalScope;

const cacheName = `embervault-${version}`;

// `build` contains hashed app assets under /_app, `files` contains anything in /static.
// Cache '/' so the SPA shell can start offline after it has been loaded once.
// Note: adapter-static fallback uses 200.html for client-side routing on some hosts,
// but local preview servers may not serve it at '/200.html'. The root URL is sufficient.
const coreUrls = ["/"] as const;
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const buildUrls = isStringArray(build) ? build : [];
const staticUrls = isStringArray(files) ? files : [];
const assetUrls: string[] = [...buildUrls, ...staticUrls, ...coreUrls];

const addAllSettled = async (
  cache: Cache,
  urls: readonly string[]
): Promise<void> => {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      await cache.add(url);
    })
  );

  // If some URLs fail to cache (e.g. hosting config differs), don't brick SW install.
  // Offline will still work for any successfully cached assets.
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    // Avoid console.* to keep committed code clean; SW install should remain resilient.
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await addAllSettled(cache, assetUrls);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== cacheName)
          .map(async (key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fallback to cached SPA shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);

          // Cache HTML navigations so deep links can reload offline after first load.
          const contentType = response.headers.get("content-type") ?? "";
          const shouldCacheHtml =
            response.ok && contentType.includes("text/html");
          if (shouldCacheHtml) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch {
          return (await cache.match("/")) ?? Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: cache-first, fallback to network.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      return fetch(request);
    })()
  );
});
