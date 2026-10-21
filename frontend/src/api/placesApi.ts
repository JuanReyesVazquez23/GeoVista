import { fallbackPlaces } from '../data/fallbackPlaces';
import type { PagedResult, Place } from '../types';

// En dev es '' (usa el proxy de Vite); en producción (Vercel) se inyecta
// VITE_API_URL=https://tu-api.onrender.com al compilar.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

// Error HTTP real: el servidor respondió, así que NO hay que taparlo con el
// catálogo local (un 404 de categoría no debe devolver un lugar de otra).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// La API no es alcanzable (offline, DNS, cold start): aquí sí procede el fallback.
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

async function readError(res: Response): Promise<string> {
  const fallback = `HTTP ${res.status}`;
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'string') return parsed;
      if (parsed && typeof parsed === 'object') {
        const body = parsed as Record<string, unknown>;
        for (const key of ['error', 'detail', 'title', 'message']) {
          const value = body[key];
          if (typeof value === 'string' && value.trim()) return value;
        }
        const errors = body.errors;
        if (errors && typeof errors === 'object') {
          const first = Object.values(errors as Record<string, unknown>)
            .flat()
            .find((value) => typeof value === 'string');
          if (typeof first === 'string') return first;
        }
      }
      return text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new NetworkError(`No se pudo conectar con la API (${url}).`);
  }
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return res.json() as Promise<T>;
}

// Mismo criterio que ?category= del backend (también lo usa el modo favoritos).
export function inCategory(p: Place, scope?: string): boolean {
  const s = scope?.trim().toLowerCase();
  return !s || s === 'todas' || p.category.toLowerCase() === s;
}

// Insensible a acentos y mayúsculas, igual que ?q= del backend:
// "montana" encuentra "Montaña", "PISA" encuentra "Pisa".
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function matchesQuery(p: Place, needle: string): boolean {
  const n = fold(needle.trim());
  if (!n) return true;
  return (
    fold(p.name).includes(n) ||
    fold(p.country).includes(n) ||
    fold(p.category).includes(n) ||
    fold(p.description).includes(n)
  );
}

// Verifica la clave contra el backend sin efectos (GET /api/admin/ping).
export async function verifyAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/ping`, {
      headers: { 'X-Admin-Key': key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Mutaciones del panel admin (header X-Admin-Key).
async function mutate(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  key: string,
  body?: Place,
): Promise<Place | null> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await readError(res));
  return res.status === 204 ? null : ((await res.json()) as Place);
}

export function createPlace(place: Place, key: string): Promise<Place | null> {
  return mutate('/api/places', 'POST', key, place);
}

export function updatePlace(place: Place, key: string): Promise<Place | null> {
  return mutate(`/api/places/${place.id}`, 'PUT', key, place);
}

export function deletePlace(id: string, key: string): Promise<Place | null> {
  return mutate(`/api/places/${id}`, 'DELETE', key);
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
  const qs = scope ? `?category=${encodeURIComponent(scope)}` : '';
  try {
    return await fetchJson<Place>(`${API_BASE}/api/places/random${qs}`);
  } catch (error) {
    // 4xx = respuesta del servidor (p. ej. categoría vacía). Se propaga para
    // que la UI lo explique; nunca se sustituye por un lugar de otra categoría.
    if (error instanceof ApiError && error.status < 500) throw error;

    // Sin red o 5xx: catálogo local, respetando SIEMPRE la categoría pedida.
    const pool = localPool(scope);
    if (pool.length === 0) {
      throw new ApiError(
        404,
        scope ? `No hay destinos en la categoría "${scope}".` : 'No hay destinos disponibles.',
      );
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// Página del grid: /api/places?page=&pageSize=&category= (cacheada 1 h por página).
// Sin backend, pagina el catálogo local con el mismo sobre.
export async function getPagedPlaces(
  page: number,
  pageSize: number,
  category?: string,
  q?: string,
): Promise<PagedResult<Place>> {
  const scope = category?.trim();
  const term = q?.trim();
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(scope ? { category: scope } : {}),
    ...(term ? { q: term } : {}),
  }).toString();
  try {
    return await fetchJson<PagedResult<Place>>(`${API_BASE}/api/places?${qs}`);
  } catch {
    const pool = localPool(scope).filter((p) => matchesQuery(p, term ?? ''));
    const safeSize = Math.min(Math.max(pageSize, 1), 50);
    const safePage = Math.max(page, 1);
    const totalPages = Math.max(1, Math.ceil(pool.length / safeSize));
    const items = pool.slice((safePage - 1) * safeSize, safePage * safeSize);
    return { items, page: safePage, pageSize: safeSize, totalCount: pool.length, totalPages };
  }
}
