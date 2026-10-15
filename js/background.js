// Keeps a daily alarm alive so the cached wallpaper date can be
// invalidated even if the user doesn't open a new tab that day.
// The actual fetch happens lazily in newtab.js on next page load.

importScripts("config.js");

chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create("daily-wallpaper-check", { periodInMinutes: 60 });

  if (details.reason !== "install") return;
  if (typeof BROWSER_COUNT_URL !== "string" || !BROWSER_COUNT_URL || BROWSER_COUNT_URL.includes("YOUR_")) return;

  chrome.storage.local.get({ installCounted: false }, ({ installCounted }) => {
    if (installCounted) return;
    fetch(`${BROWSER_COUNT_URL}?action=increment`, { cache: "no-store" })
      .then(() => chrome.storage.local.set({ installCounted: true }))
      .catch(() => {});
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "daily-wallpaper-check") return;

  chrome.storage.local.get({ cache: null }, ({ cache }) => {
    if (!cache) return;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (cache.date !== todayKey) {
      chrome.storage.local.remove("cache");
    }
  });
});
