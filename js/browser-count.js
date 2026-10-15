(() => {
  "use strict";

  const wrapEl = document.getElementById("browser-count");
  const numberEl = document.getElementById("browser-count-number");
  if (!wrapEl || !numberEl) return;

  function showCount(n) {
    numberEl.textContent = n.toLocaleString();
    wrapEl.classList.add("visible");
  }

  // Show the last known count immediately so the badge doesn't sit blank
  // while the network request is in flight.
  chrome.storage.local.get({ browserCount: null }, ({ browserCount }) => {
    if (typeof browserCount === "number") showCount(browserCount);
  });

  if (typeof BROWSER_COUNT_URL !== "string" || !BROWSER_COUNT_URL || BROWSER_COUNT_URL.includes("YOUR_")) {
    return;
  }

  fetch(BROWSER_COUNT_URL, { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && typeof data.count === "number") {
        showCount(data.count);
        chrome.storage.local.set({ browserCount: data.count });
      }
    })
    .catch(() => {
      // Offline or the endpoint isn't configured yet - keep showing the
      // cached value (if any) and fail silently.
    });
})();
