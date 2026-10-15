(() => {
  "use strict";

  // 7-day forecast shown under the date. Location comes from the visitor's IP
  // (no geolocation permission or prompt needed); forecast data from Open-Meteo
  // (free, no API key). Both are cached in chrome.storage.local for an hour.
  const CACHE_KEY = "weatherCache";
  const CACHE_TTL_MS = 60 * 60 * 1000;
  const GEO_URL = "https://get.geojs.io/v1/ip/geo.json";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

  const weatherEl = document.getElementById("weather");

  // WMO weather interpretation codes -> icon + label
  function describeCode(code) {
    if (code === 0) return { icon: "☀️", label: "Clear" };
    if (code <= 2) return { icon: "🌤️", label: "Partly cloudy" };
    if (code === 3) return { icon: "☁️", label: "Overcast" };
    if (code <= 48) return { icon: "🌫️", label: "Fog" };
    if (code <= 57) return { icon: "🌦️", label: "Drizzle" };
    if (code <= 67) return { icon: "🌧️", label: "Rain" };
    if (code <= 77) return { icon: "🌨️", label: "Snow" };
    if (code <= 82) return { icon: "🌧️", label: "Rain showers" };
    if (code <= 86) return { icon: "🌨️", label: "Snow showers" };
    return { icon: "⛈️", label: "Thunderstorm" };
  }

  function useFahrenheit() {
    const region = (navigator.language || "").split("-")[1] || "";
    return ["US", "LR", "MM", "BS", "BZ", "KY", "PW"].includes(region.toUpperCase());
  }

  function getCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [CACHE_KEY]: null }, (data) => resolve(data[CACHE_KEY]));
    });
  }

  function setCache(value) {
    return new Promise((resolve) => chrome.storage.local.set({ [CACHE_KEY]: value }, resolve));
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed ${res.status}: ${url}`);
    return res.json();
  }

  async function fetchForecast(unit) {
    const geo = await fetchJson(GEO_URL);
    const params = new URLSearchParams({
      latitude: geo.latitude,
      longitude: geo.longitude,
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "7",
      temperature_unit: unit,
    });
    const data = await fetchJson(`${FORECAST_URL}?${params.toString()}`);
    return {
      city: geo.city || "",
      days: data.daily.time.map((date, i) => ({
        date,
        code: data.daily.weather_code[i],
        max: Math.round(data.daily.temperature_2m_max[i]),
        min: Math.round(data.daily.temperature_2m_min[i]),
      })),
    };
  }

  function render(forecast) {
    weatherEl.innerHTML = "";

    forecast.days.forEach((day, i) => {
      const { icon, label } = describeCode(day.code);
      // dates are local calendar days (YYYY-MM-DD); parse at noon to avoid TZ drift
      const name =
        i === 0
          ? "Today"
          : new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short" });

      const cell = document.createElement("div");
      cell.className = "weather-day";
      cell.title = label;

      const nameEl = document.createElement("div");
      nameEl.className = "weather-day-name";
      nameEl.textContent = name;

      const iconEl = document.createElement("div");
      iconEl.className = "weather-icon";
      iconEl.textContent = icon;

      const tempEl = document.createElement("div");
      tempEl.className = "weather-temp";
      tempEl.textContent = `${day.max}° `;
      const minEl = document.createElement("span");
      minEl.className = "weather-temp-min";
      minEl.textContent = `${day.min}°`;
      tempEl.appendChild(minEl);

      cell.append(nameEl, iconEl, tempEl);
      weatherEl.appendChild(cell);
    });

    if (forecast.city) weatherEl.title = `7-day forecast for ${forecast.city}`;
    weatherEl.classList.add("loaded");
  }

  async function init() {
    const unit = useFahrenheit() ? "fahrenheit" : "celsius";
    const cache = await getCache();
    const fresh = cache && cache.unit === unit && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

    if (cache && cache.forecast) render(cache.forecast);
    if (fresh) return;

    try {
      const forecast = await fetchForecast(unit);
      await setCache({ unit, fetchedAt: Date.now(), forecast });
      render(forecast);
    } catch (err) {
      // keep showing stale data if we have it; otherwise stay hidden
      console.error(err);
    }
  }

  init();
})();
