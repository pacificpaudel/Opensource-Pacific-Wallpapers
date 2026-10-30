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
      city: geo.city || geo.region || geo.country || "",
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

    const dateEl = document.createElement("div");
    dateEl.className = "weather-date";
    dateEl.textContent = new Date().toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const daysEl = document.createElement("div");
    daysEl.className = "weather-days";
    const futureEl = document.createElement("div");
    futureEl.className = "weather-future";
    futureEl.append(dateEl, daysEl);
    let todayCell;

    forecast.days.forEach((day, i) => {
      const { icon, label } = describeCode(day.code);
      // dates are local calendar days (YYYY-MM-DD); parse at noon to avoid TZ drift
      const name =
        i === 0
          ? "Today"
          : new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short" });

      const cell = document.createElement("div");
      cell.className = "weather-day";
      if (i === 0) cell.classList.add("weather-day-today");
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
      if (i === 0 && forecast.city) {
        const locationEl = document.createElement("div");
        locationEl.className = "weather-location";
        locationEl.textContent = forecast.city;
        cell.appendChild(locationEl);
      }
      if (i === 0) todayCell = cell;
      else daysEl.appendChild(cell);
    });

    if (todayCell) weatherEl.append(todayCell, futureEl);
    if (forecast.city) weatherEl.title = `7-day forecast for ${forecast.city}`;
    weatherEl.classList.add("loaded");
  }

  async function init() {
    const unit = "celsius";
    const cache = await getCache();
    // ignore forecasts cached in another unit (older versions used °F in the US)
    const usable = cache && cache.unit === unit && cache.forecast;
    const fresh = usable && Date.now() - cache.fetchedAt < CACHE_TTL_MS;

    if (usable) render(cache.forecast);
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
