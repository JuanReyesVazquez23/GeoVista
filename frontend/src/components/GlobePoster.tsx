import { useEffect, useRef } from 'react';
import { RAMP_LUT, TOPOLOGY_URL } from '../globeTexture';

// Globo 2D para móvil: proyección ortográfica real sobre un canvas.
// Muestra continentes con relieve y sombreado esférico, sin descargar three.js
// (~2 MB). La imagen se pinta una sola vez y se cachea como data URL.

const SIZE = 512;
// Vista centrada en el Atlántico: se ven América, Europa y África.
const CENTER_LAT = 18;
const CENTER_LON = -35;

let cachedPoster: string | null = null;

function paintGlobe(canvas: HTMLCanvasElement, texture: HTMLImageElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Textura equirectangular → píxeles de origen.
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = texture.width;
  srcCanvas.height = texture.height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) return '';
  srcCtx.drawImage(texture, 0, 0);
  const src = srcCtx.getImageData(0, 0, texture.width, texture.height).data;
  const sw = texture.width;
  const sh = texture.height;

  const phi = (CENTER_LAT * Math.PI) / 180;
  const lam = (CENTER_LON * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lam);
  const cosLam = Math.cos(lam);

  // Base de la cámara ortográfica: derecha (E), arriba (N) y hacia el espectador (C).
  const Ex = -sinLam;
  const Nx = -sinPhi * cosLam;
  const Ny = cosPhi;
  const Nz = -sinPhi * sinLam;
  const Cx = cosPhi * cosLam;
  const Cy = sinPhi;
  const Cz = cosPhi * sinLam;

  // Luz fija arriba-izquierda para dar volumen.
  const lx = -0.45;
  const ly = 0.55;
  const lz = 0.7;
  const ll = Math.hypot(lx, ly, lz);
  const Lx = lx / ll;
  const Ly = ly / ll;
  const Lz = lz / ll;

  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;
  const radius = SIZE / 2;

  for (let y = 0; y < SIZE; y++) {
    const sy = -(y - radius + 0.5) / radius;
    for (let x = 0; x < SIZE; x++) {
      const sx = (x - radius + 0.5) / radius;
      const r2 = sx * sx + sy * sy;
      if (r2 >= 1) continue;

      const sz = Math.sqrt(1 - r2);
      // Punto en el espacio de la cámara → coordenadas del globo.
      const px = sx * Ex + sy * Nx + sz * Cx;
      const py = sy * Ny + sz * Cy;
      const pz = sx * (cosLam) + sy * Nz + sz * Cz;

      const lat = Math.asin(Math.max(-1, Math.min(1, py)));
      const lon = Math.atan2(pz, px);
      const u = (lon + Math.PI) / (2 * Math.PI);
      const v = (Math.PI / 2 - lat) / Math.PI;

      const tx = Math.min(sw - 1, Math.max(0, Math.round(u * sw)));
      const ty = Math.min(sh - 1, Math.max(0, Math.round(v * sh)));
      const si = (ty * sw + tx) * 4;
      // Luminancia del relieve: océanos oscuros, continentes y cumbres claros.
      // Gamma < 1 levanta los medios tonos: los países se leen sobre el fondo
      // sin aclarar los océanos (que quedan casi negros).
      const raw = (0.299 * src[si] + 0.587 * src[si + 1] + 0.114 * src[si + 2]) / 255;
      const lum = Math.pow(raw, 0.62);
      const [br, bg, bb] = RAMP_LUT[Math.round(lum * 255)];

      const shade = Math.max(0, sx * Lx + sy * Ly + sz * Lz);
      const light = 0.5 + 0.5 * shade;
      const limb = 0.72 + 0.28 * sz;
      const f = light * limb;

      // Borde suavizado (~2 px) para que no se vea dentado al escalar.
      const alpha = Math.min(1, (1 - r2) * radius * 0.5);

      const di = (y * SIZE + x) * 4;
      data[di] = br * f;
      data[di + 1] = bg * f;
      data[di + 2] = bb * f;
      data[di + 3] = Math.round(255 * alpha);
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export default function GlobePoster() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let alive = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Si ya se pintó en esta sesión, solo se copia el data URL cacheado.
    if (cachedPoster) {
      const img = new Image();
      img.onload = () => {
        if (alive) canvas.getContext('2d')?.drawImage(img, 0, 0, SIZE, SIZE);
      };
      img.src = cachedPoster;
      return () => {
        alive = false;
      };
    }

    const texture = new Image();
    texture.decoding = 'async';
    texture.onload = () => {
      if (!alive) return;
      try {
        cachedPoster = paintGlobe(canvas, texture);
      } catch {
        // Sin textura queda el degradado CSS de respaldo: nunca un hueco.
      }
    };
    texture.src = TOPOLOGY_URL;

    return () => {
      alive = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="globe-poster-canvas"
      width={SIZE}
      height={SIZE}
      aria-hidden="true"
    />
  );
}
