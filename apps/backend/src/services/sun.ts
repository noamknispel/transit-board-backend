/**
 * Where the sun and moon are, worked out locally (no network): the sun's
 * altitude from the standard low-precision solar position formulas, and the
 * moon's phase from the mean synodic month. Good to a degree or two, which is
 * plenty for painting a 128x32 sky.
 */

const RAD = Math.PI / 180;
/** Altitude at which the sun's upper edge touches the horizon, with refraction. */
const HORIZON_ALT = -0.833;
const STEP_MS = 5 * 60 * 1000;
const SEARCH_MS = 26 * 60 * 60 * 1000;
const SYNODIC_DAYS = 29.530588853;
/** A new moon: 2000-01-06 18:14 UTC, as a Julian date. */
const NEW_MOON_JD = 2451550.26;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Sun altitude in degrees above the horizon at `ms` (epoch millis) for a spot on Earth. */
export function sunAltitude(ms: number, latitude: number, longitude: number): number {
  const n = ms / 86400000 + 2440587.5 - 2451545.0;
  const meanLon = mod(280.46 + 0.9856474 * n, 360);
  const anomaly = mod(357.528 + 0.9856003 * n, 360) * RAD;
  const lambda = (meanLon + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda));
  const gmst = mod(280.46061837 + 360.98564736629 * n, 360) * RAD;
  const hourAngle = gmst + longitude * RAD - rightAscension;
  const lat = latitude * RAD;
  return Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)) / RAD;
}

/** Moon phase from 0 (new) through 0.5 (full) back to 1 (new). */
export function moonPhase(ms: number): number {
  const jd = ms / 86400000 + 2440587.5;
  return mod((jd - NEW_MOON_JD) / SYNODIC_DAYS, 1);
}

export interface SkyState {
  /** Sun altitude in degrees; negative once it is below the horizon. */
  altitude: number;
  /** Sun above the horizon. */
  up: boolean;
  /** How far the sun (by day) or the moon (by night) has travelled across the sky, 0 to 1. */
  frac: number;
  /** 0 new, 0.5 full. */
  moonPhase: number;
}

/** First time before/after `from` (stepping by `dir`) that the sun crosses the horizon, or null. */
function findCrossing(from: number, dir: 1 | -1, isUp: boolean, lat: number, lon: number): number | null {
  let prev = from;
  for (let t = from + dir * STEP_MS; Math.abs(t - from) <= SEARCH_MS; t += dir * STEP_MS) {
    const up = sunAltitude(t, lat, lon) > HORIZON_ALT;
    if (up !== isUp) return (prev + t) / 2;
    prev = t;
  }
  return null;
}

/** Sky for a real place and moment. Midway when the sun never crosses the horizon (polar day or night). */
export function skyAt(ms: number, latitude: number, longitude: number): SkyState {
  const altitude = sunAltitude(ms, latitude, longitude);
  const up = altitude > HORIZON_ALT;
  const start = findCrossing(ms, -1, up, latitude, longitude);
  const end = findCrossing(ms, 1, up, latitude, longitude);
  const frac = start !== null && end !== null && end > start ? (ms - start) / (end - start) : 0.5;
  return { altitude, up, frac: Math.min(1, Math.max(0, frac)), moonPhase: moonPhase(ms) };
}

/** Without a location: the sun is up 6:00 to 19:00 local time. */
export function skyFromLocalMinutes(minutes: number, ms: number): SkyState {
  const rise = 6 * 60;
  const set = 19 * 60;
  const up = minutes >= rise && minutes < set;
  const frac = up ? (minutes - rise) / (set - rise) : mod(minutes - set, 1440) / (1440 - (set - rise));
  return { altitude: 55 * Math.sin((Math.PI * (minutes - rise)) / (set - rise)), up, frac, moonPhase: moonPhase(ms) };
}
