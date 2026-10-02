import { fallbackPlaces } from '../data/fallbackPlaces';
import type { PagedResult, Place } from '../types';

// En dev es '' (usa el proxy de Vite); en producción (Vercel) se inyecta
// VITE_API_URL=https://tu-api.onrender.com al compilar.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json() as Promise<T>;
}

// Mismo criterio que ?category= del backend (también lo usa el modo favoritos).
export function inCategory(p: Place, scope?: string): boolean {
  const s = scope?.trim().toLowerCase();
  return !s || s === 'todas' || p.category.toLowerCase() === s;
}

function localPool(scope?: string): Place[] {
  return fallbackPlaces.filter((p) => inCategory(p, scope));
}

// Intenta el backend ASP.NET Core; si no está levantado, usa el fallback local.
export async function getPlaces(): Promise<Place[]> {
  try {
    return await fetchJson<Place[]>(`${API_BASE}/api/places`);
  } catch {
    return fallbackPlaces;
  }
}

export async function getRandomPlace(category?: string): Promise<Place> {
  const scope = category?.trim();
  try {
    const qs = scope ? `?category=${encodeURIComponent(scope)}` : '';
    return await fetchJson<Place>(`${API_BASE}/api/places/random${qs}`);
  } catch {
    const pool = localPool(scope);
    const list = pool.length > 0 ? pool : fallbackPlaces;
    return list[Math.floor(Math.random() * list.length)];
  }
}

// Página del grid: /api/places?page=&pageSize=&category= (cacheada 1 h por página).
// Sin backend, pagina el catálogo local con el mismo sobre.
export async function getPagedPlaces(
  page: number,
  pageSize: number,
  category?: string,
): Promise<PagedResult<Place>> {
  const scope = category?.trim();
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(scope ? { category: scope } : {}),
  }).toString();
  try {
    return await fetchJson<PagedResult<Place>>(`${API_BASE}/api/places?${qs}`);
  } catch {
    const pool = localPool(scope);
    const safeSize = Math.min(Math.max(pageSize, 1), 50);
    const safePage = Math.max(page, 1);
    const totalPages = Math.max(1, Math.ceil(pool.length / safeSize));
    const items = pool.slice((safePage - 1) * safeSize, safePage * safeSize);
    return { items, page: safePage, pageSize: safeSize, totalCount: pool.length, totalPages };
  }
}
