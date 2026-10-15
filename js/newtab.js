(() => {
  "use strict";

  const DEFAULTS = {
    source: "free", // free | pixabay
    apiKey: "",
    category: "",
    mode: "daily", // daily | newtab | manual
    searchEngine: "google",
  };

  const els = {
    wallpaper: document.getElementById("wallpaper"),
    gearBtn: document.getElementById("gear-btn"),
    panel: document.getElementById("panel"),
    closePanel: document.getElementById("close-panel"),
    sourceSelect: document.getElementById("source-select"),
    pixabayFields: document.getElementById("pixabay-fields"),
    categorySelect: document.getElementById("category-select"),
    modeSelect: document.getElementById("mode-select"),
    apiKeyInput: document.getElementById("api-key-input"),
    saveKeyBtn: document.getElementById("save-key-btn"),
    newWallpaperBtn: document.getElementById("new-wallpaper-btn"),
    statusMsg: document.getElementById("status-msg"),
    timeEl: document.getElementById("time"),
    dateEl: document.getElementById("date"),
    weatherEl: document.getElementById("weather"),
    searchEngineSelect: document.getElementById("search-engine-select"),
    searchForm: document.getElementById("search-form"),
    searchInput: document.getElementById("search-input"),
  };

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function getStorage() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (settings) => {
        chrome.storage.local.get({ cache: null }, (localData) => {
          resolve({ settings, cache: localData.cache });
        });
      });
    });
  }

  function setSettings(partial) {
    return new Promise((resolve) => chrome.storage.sync.set(partial, resolve));
  }

  function setCache(cache) {
    return new Promise((resolve) => chrome.storage.local.set({ cache }, resolve));
  }

  function setStatus(msg, type) {
    els.statusMsg.textContent = msg || "";
    els.statusMsg.className = "status-msg" + (type ? ` ${type}` : "");
  }

  function populateCategories(selected) {
    els.categorySelect.innerHTML = "";
    for (const cat of PIXABAY_CATEGORIES) {
      const opt = document.createElement("option");
      opt.value = cat.value;
      opt.textContent = cat.label;
      if (cat.value === selected) opt.selected = true;
      els.categorySelect.appendChild(opt);
    }
  }

  function populateSearchEngines(selected) {
    els.searchEngineSelect.innerHTML = "";
    for (const engine of SEARCH_ENGINES) {
      const opt = document.createElement("option");
      opt.value = engine.value;
      opt.textContent = engine.label;
      if (engine.value === selected) opt.selected = true;
      els.searchEngineSelect.appendChild(opt);
    }
  }

  function wireSearch(settings) {
    populateSearchEngines(settings.searchEngine || DEFAULTS.searchEngine);

    els.searchEngineSelect.addEventListener("change", () => {
      setSettings({ searchEngine: els.searchEngineSelect.value });
    });

    els.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = els.searchInput.value.trim();
      if (!query) return;
      const engine =
        SEARCH_ENGINES.find((eng) => eng.value === els.searchEngineSelect.value) || SEARCH_ENGINES[0];
      window.location.href = engine.url + encodeURIComponent(query);
    });
  }

  // Simple deterministic hash -> used to pick the same "random" image
  // for a given day + category so the wallpaper stays fixed all day.
  function seededIndex(seedStr, max) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % max;
  }

  function randomSeed() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function pictureDimensions() {
    const width = Math.min(3840, Math.max(1920, Math.round(screen.width * (window.devicePixelRatio || 1))));
    const height = Math.min(2160, Math.max(1080, Math.round(screen.height * (window.devicePixelRatio || 1))));
    return { width, height };
  }

  function picsumUrl(seed) {
    const { width, height } = pictureDimensions();
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
  }

  async function fetchPixabayHits(apiKey, category) {
    const params = new URLSearchParams({
      key: apiKey,
      image_type: "photo",
      orientation: "horizontal",
      safesearch: "true",
      order: "popular",
      per_page: "200",
    });
    if (category) params.set("category", category);

    const res = await fetch(`https://pixabay.com/api/?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Pixabay API error ${res.status}: ${body || res.statusText}`);
    }
    const data = await res.json();
    if (!data.hits || !data.hits.length) {
      throw new Error("No wallpapers found for this category.");
    }
    return data.hits;
  }

  function applyWallpaperUrl(url) {
    const img = new Image();
    img.onload = () => {
      els.wallpaper.style.backgroundImage = `url("${url}")`;
      requestAnimationFrame(() => els.wallpaper.classList.add("loaded"));
    };
    img.onerror = () => setStatus("Failed to load wallpaper.", "error");
    img.src = url;
  }

  async function pickAndApplyFree({ settings, forceNew }) {
    const today = todayKey();
    let seed;

    if (settings.mode === "newtab") {
      // always a fresh image per tab, never cached
      seed = randomSeed();
    } else if (forceNew) {
      // explicit "New wallpaper now" (or a settings change) always picks a new image,
      // and the pick sticks for the rest of the day/until forced again
      seed = randomSeed();
      await setCache({ source: "free", mode: settings.mode, date: today, seed });
    } else {
      const { cache } = await getStorage();
      const cacheIsValid =
        cache &&
        cache.source === "free" &&
        cache.mode === settings.mode &&
        (settings.mode === "manual" || cache.date === today) &&
        cache.seed;

      if (cacheIsValid) {
        seed = cache.seed;
      } else if (settings.mode === "daily") {
        // deterministic seed so it's stable across reloads the same day
        seed = `daily-${today}`;
        await setCache({ source: "free", mode: "daily", date: today, seed });
      } else {
        // manual mode with no valid cache yet
        seed = randomSeed();
        await setCache({ source: "free", mode: "manual", date: today, seed });
      }
    }

    setStatus("Loading wallpaper…");
    applyWallpaperUrl(picsumUrl(seed));
    setStatus("Wallpaper updated.", "success");
    setTimeout(() => setStatus(""), 1500);
  }

  async function pickAndApplyPixabay({ settings, forceNew }) {
    if (!settings.apiKey) {
      setStatus("Add your free Pixabay API key, or switch to Free photos above.", "error");
      els.panel.classList.remove("hidden");
      return;
    }

    const key = todayKey();
    const cache = (await getStorage()).cache;

    const cacheIsValid =
      !forceNew &&
      cache &&
      cache.source === "pixabay" &&
      cache.category === settings.category &&
      (settings.mode === "manual" || settings.mode === "daily") &&
      (settings.mode === "manual" || cache.date === key);

    if (cacheIsValid && cache.hit) {
      applyWallpaperUrl(cache.hit.largeImageURL);
      return;
    }

    try {
      setStatus("Loading wallpaper…");
      const hits = await fetchPixabayHits(settings.apiKey, settings.category);

      let hit;
      if (settings.mode === "newtab") {
        hit = hits[Math.floor(Math.random() * hits.length)];
      } else if (forceNew) {
        hit = hits[Math.floor(Math.random() * hits.length)];
      } else {
        // daily: deterministic pick so it's stable across reloads the same day
        hit = hits[seededIndex(key + settings.category, hits.length)];
      }

      applyWallpaperUrl(hit.largeImageURL);
      await setCache({ source: "pixabay", date: key, category: settings.category, hit });
      setStatus("Wallpaper updated.", "success");
      setTimeout(() => setStatus(""), 2500);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Failed to load wallpaper.", "error");
    }
  }

  async function pickAndApply({ settings, forceNew }) {
    if (settings.source === "pixabay") {
      await pickAndApplyPixabay({ settings, forceNew });
    } else {
      await pickAndApplyFree({ settings, forceNew });
    }
  }

  function updateClock() {
    const now = new Date();
    els.timeEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    els.dateEl.textContent = now.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    fitClockRows();
  }

  // Keep the time, date and weather rows the same width. The time sets the
  // width (never below CLOCK_MIN_WIDTH, so the 7-day forecast stays legible
  // with short 24-hour times) and each row scales its font size to match.
  const CLOCK_MIN_WIDTH = 320;

  function fitClockRows() {
    const rows = [els.timeEl, els.dateEl, els.weatherEl].filter((el) => el.childNodes.length);
    rows.forEach((el) => (el.style.fontSize = ""));
    const target = Math.max(els.timeEl.offsetWidth, CLOCK_MIN_WIDTH);
    for (const el of rows) {
      const width = el.offsetWidth;
      if (!width) continue;
      const base = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = `${(base * target) / width}px`;
    }
  }

  function updateSourceFieldsVisibility(source) {
    els.pixabayFields.classList.toggle("field-hidden", source !== "pixabay");
  }

  function wirePanel(settings) {
    els.gearBtn.addEventListener("click", () => {
      els.panel.classList.toggle("hidden");
    });
    els.closePanel.addEventListener("click", () => {
      els.panel.classList.add("hidden");
    });
    document.addEventListener("click", (e) => {
      if (
        !els.panel.classList.contains("hidden") &&
        !els.panel.contains(e.target) &&
        e.target !== els.gearBtn &&
        !els.gearBtn.contains(e.target)
      ) {
        els.panel.classList.add("hidden");
      }
    });

    els.sourceSelect.value = settings.source || DEFAULTS.source;
    els.apiKeyInput.value = settings.apiKey || "";
    els.modeSelect.value = settings.mode || DEFAULTS.mode;
    updateSourceFieldsVisibility(els.sourceSelect.value);

    els.sourceSelect.addEventListener("change", async () => {
      const source = els.sourceSelect.value;
      updateSourceFieldsVisibility(source);
      await setSettings({ source });
      const updated = { ...settings, source, apiKey: els.apiKeyInput.value.trim() || settings.apiKey };
      await pickAndApply({ settings: updated, forceNew: true });
    });

    els.saveKeyBtn.addEventListener("click", async () => {
      const apiKey = els.apiKeyInput.value.trim();
      await setSettings({ apiKey });
      setStatus("API key saved.", "success");
      const updated = { ...settings, apiKey, source: els.sourceSelect.value };
      await pickAndApply({ settings: updated, forceNew: true });
    });

    els.categorySelect.addEventListener("change", async () => {
      const category = els.categorySelect.value;
      await setSettings({ category });
      const updated = {
        ...settings,
        category,
        source: els.sourceSelect.value,
        apiKey: els.apiKeyInput.value.trim() || settings.apiKey,
      };
      await pickAndApply({ settings: updated, forceNew: true });
    });

    els.modeSelect.addEventListener("change", async () => {
      const mode = els.modeSelect.value;
      await setSettings({ mode });
      const updated = { ...settings, mode, source: els.sourceSelect.value };
      await pickAndApply({ settings: updated, forceNew: true });
    });

    els.newWallpaperBtn.addEventListener("click", async () => {
      const current = await getStorage();
      await pickAndApply({ settings: current.settings, forceNew: true });
    });
  }

  async function init() {
    updateClock();
    setInterval(updateClock, 1000 * 30);
    // weather.js fills its row asynchronously; web fonts can also shift widths
    new MutationObserver(fitClockRows).observe(els.weatherEl, { childList: true });
    document.fonts.ready.then(fitClockRows);

    const { settings } = await getStorage();
    populateCategories(settings.category);
    wirePanel(settings);
    wireSearch(settings);

    await pickAndApply({ settings, forceNew: settings.mode === "newtab" });
  }

  init();
})();
