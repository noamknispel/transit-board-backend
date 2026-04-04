interface WeatherResult {
  temp: number;
  unit: "F" | "C";
  summary: string;
}

interface WeatherCacheEntry {
  data: WeatherResult;
  fetchedAt: number;
}

const WEATHER_CODE_SUMMARY: Record<number, string> = {
  0: "CLR",
  1: "MSUN",
  2: "PCLD",
  3: "CLDY",
  45: "FOG",
  48: "FOG",
  51: "DRIZ",
  53: "DRIZ",
  55: "DRIZ",
  56: "FRZR",
  57: "FRZR",
  61: "RAIN",
  63: "RAIN",
  65: "RAIN",
  66: "FRZR",
  67: "FRZR",
  71: "SNOW",
  73: "SNOW",
  75: "SNOW",
  77: "SNOW",
  80: "SHWR",
  81: "SHWR",
  82: "SHWR",
  85: "SNOW",
  86: "SNOW",
  95: "STORM",
  96: "STORM",
  99: "STORM",
};

export class WeatherService {
  private static readonly CACHE_TTL_MS =
    Math.max(60, Number(process.env.WEATHER_CACHE_TTL_SECONDS || "900")) *
    1000;

  private static readonly REQUEST_TIMEOUT_MS = Math.max(
    1000,
    Number(process.env.WEATHER_REQUEST_TIMEOUT_MS || "3000"),
  );

  private static cache = new Map<string, WeatherCacheEntry>();
  private static inFlight = new Map<string, Promise<WeatherResult | null>>();

  private getCacheKey(
    latitude: number,
    longitude: number,
    temperatureUnit: "F" | "C",
  ): string {
    return `${latitude.toFixed(4)},${longitude.toFixed(4)},${temperatureUnit}`;
  }

  private getSummary(weatherCode: number): string {
    return WEATHER_CODE_SUMMARY[weatherCode] || "WX";
  }

  async getCurrentWeather(
    latitude: number,
    longitude: number,
    temperatureUnit: "F" | "C",
  ): Promise<WeatherResult | null> {
    const cacheKey = this.getCacheKey(latitude, longitude, temperatureUnit);

    const now = Date.now();
    const cached = WeatherService.cache.get(cacheKey);
    if (cached && now - cached.fetchedAt < WeatherService.CACHE_TTL_MS) {
      return cached.data;
    }

    const pending = WeatherService.inFlight.get(cacheKey);
    if (pending) {
      return pending;
    }

    const unitParam = temperatureUnit === "F" ? "fahrenheit" : "celsius";
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      "&current=temperature_2m,weather_code" +
      `&temperature_unit=${unitParam}` +
      "&timezone=auto";

    const requestPromise = (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          WeatherService.REQUEST_TIMEOUT_MS,
        );

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Weather HTTP ${response.status}`);
        }

        const payload = (await response.json()) as {
          current?: {
            temperature_2m?: number;
            weather_code?: number;
          };
        };

        const temperature = payload.current?.temperature_2m;
        const weatherCode = payload.current?.weather_code;

        if (typeof temperature !== "number" || typeof weatherCode !== "number") {
          return null;
        }

        const data: WeatherResult = {
          temp: Math.round(temperature),
          unit: temperatureUnit,
          summary: this.getSummary(weatherCode),
        };

        WeatherService.cache.set(cacheKey, {
          data,
          fetchedAt: Date.now(),
        });

        return data;
      } catch (error) {
        console.error("Weather fetch error:", error);
        return null;
      } finally {
        WeatherService.inFlight.delete(cacheKey);
      }
    })();

    WeatherService.inFlight.set(cacheKey, requestPromise);
    return requestPromise;
  }
}
