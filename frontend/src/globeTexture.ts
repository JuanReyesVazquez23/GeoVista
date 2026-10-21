// Textura de relieve compartida por el globo 3D (escritorio) y el póster 2D
// (móvil). Servida desde /public para no depender de unpkg en tiempo de ejecución
// (misma imagen, misma caché y sin CORS).
export const TOPOLOGY_URL = '/earth-topology.png';

// Paleta azul GeoVista (del fondo de la página al cyan de acento):
// océano profundo → plataforma → costa → tierra → cumbres.
export const STOPS: Array<[number, [number, number, number]]> = [
  [0, [5, 14, 28]],
  [0.35, [10, 42, 74]],
  [0.6, [22, 96, 142]],
  [0.8, [38, 148, 198]],
  [1, [130, 214, 246]],
];

export function ramp(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (clamped <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const k = (clamped - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// Tabla de 256 colores: evita recorrer los stops en cada píxel del póster.
export const RAMP_LUT: Array<[number, number, number]> = Array.from(
  { length: 256 },
  (_, i) => ramp(i / 255),
);
