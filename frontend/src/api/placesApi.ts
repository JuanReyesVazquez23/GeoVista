import { fallbackPlaces } from '../data/fallbackPlaces';
import type { Place } from '../types';

const API_BASE = '';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json() as Promise<T>;
}

function localCategories(): string[] {
  return ['Todas', ...Array.from(new Set(fallbackPlaces.map((p) => p.category))).sort()];
}

// Intenta el backend ASP.NET Core; si no está levantado, usa el fallback local.
export async function getPlaces(): Promise<Place[]> {
  try {
    return await fetchJson<Place[]>(`${API_BASE}/api/places`);
  } catch {
    return fallbackPlaces;
  }
}

export async function getCategories(): Promise<string[]> {
  try {
    const cats = await fetchJson<string[]>(`${API_BASE}/api/places/categories`);
    return ['Todas', ...cats];
  } catch {
    return localCategories();
  }
}

export async function getRandomPlace(category?: string): Promise<Place> {
  const scope = category?.trim();
  try {
    const qs = scope ? `?category=${encodeURIComponent(scope)}` : '';
    return await fetchJson<Place>(`${API_BASE}/api/places/random${qs}`);
  } catch {
    const pool =
      scope && scope.toLowerCase() !== 'todas'
        ? fallbackPlaces.filter((p) => p.category.toLowerCase() === scope.toLowerCase())
        : fallbackPlaces;
    const list = pool.length > 0 ? pool : fallbackPlaces;
    return list[Math.floor(Math.random() * list.length)];
  }
}
