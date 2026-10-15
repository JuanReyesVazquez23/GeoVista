// Sincroniza el fallback local con la fuente de verdad (backend/Data/places.json).
// Uso: node scripts/sync-fallback.mjs [--check]
//   sin flags   → regenera src/data/fallbackPlaces.ts
//   --check      → falla (exit 1) si el archivo committed está desactualizado (para CI).
// Si la fuente no existe (deploy solo-frontend como Vercel), conserva el archivo
// actual y avisa: el último generado committed sigue siendo válido.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, '..', '..', 'backend', 'GeoVista.Api', 'Data', 'places.json');
const target = join(root, '..', 'src', 'data', 'fallbackPlaces.ts');
const check = process.argv.includes('--check');

if (!existsSync(source)) {
  console.warn(`[sync-fallback] fuente no encontrada (${source}); se conserva el fallback actual.`);
  process.exit(0);
}

const places = JSON.parse(readFileSync(source, 'utf8'));

const generated = `// AUTO-GENERADO por scripts/sync-fallback.mjs — no editar a mano.
// Fuente de verdad: backend/GeoVista.Api/Data/places.json (${places.length} lugares).
import type { Place } from '../types';

export const fallbackPlaces: Place[] = ${JSON.stringify(places, null, 2)};
`;

if (check) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== generated) {
    console.error('[sync-fallback] fallbackPlaces.ts desactualizado: ejecuta `npm run sync:fallback` y commitea el resultado.');
    process.exit(1);
  }
  console.log('[sync-fallback] fallback al día.');
} else {
  writeFileSync(target, generated);
  console.log(`[sync-fallback] ${places.length} lugares → src/data/fallbackPlaces.ts`);
}
