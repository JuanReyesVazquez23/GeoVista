// Favoritos locales de GeoVista (sin backend): solo guarda los ids.
// Por qué ids y no objetos: sobreviven a cambios del catálogo y pesan bytes.
const KEY = 'gv-favorites';

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Almacenamiento no disponible (modo privado estricto): se pierde al recargar.
  }
}

// Alterna un id y persiste. Pura respecto al array de entrada.
export function toggleFavorite(ids: string[], id: string): string[] {
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  save(next);
  return next;
}
