/**
 * localCache.js — simple localStorage helpers with TTL support
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function cacheSet(key, data, ttlMs = DEFAULT_TTL_MS) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        expires: Date.now() + ttlMs,
      }),
    );
  } catch (e) {
    console.warn("cacheSet failed:", e);
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function cacheClear(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function cacheClearPrefix(prefix) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// Scorecard-specific — no TTL, persists until round complete
export function scorecardSave(roundId, data) {
  try {
    localStorage.setItem(`scorecard:${roundId}`, JSON.stringify(data));
  } catch (e) {
    console.warn("scorecardSave failed:", e);
  }
}

export function scorecardLoad(roundId) {
  try {
    const raw = localStorage.getItem(`scorecard:${roundId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function scorecardClear(roundId) {
  try {
    localStorage.removeItem(`scorecard:${roundId}`);
  } catch {}
}
