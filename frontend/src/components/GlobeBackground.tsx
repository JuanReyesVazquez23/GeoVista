import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { ramp, TOPOLOGY_URL } from '../globeTexture';

interface Props {
  // Pausa la rotación (p. ej. cuando el modal 360° está abierto).
  paused?: boolean;
}

// Genera la textura del globo tiñendo el mapa de relieve (topology) con la
// paleta teal apagada: se conserva el relieve real de continentes.
function blueEarthTexture(): Promise<string> {
  const solidNavy = () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#071014';
    ctx.fillRect(0, 0, c.width, c.height);
    return c.toDataURL();
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(solidNavy());
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, c.width, c.height);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          // Luminancia del relieve: océanos oscuros, tierras altas claras.
          const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
          const [r, g, b] = ramp(t);
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(c.toDataURL());
      } catch {
        resolve(solidNavy());
      }
    };
    img.onerror = () => resolve(solidNavy());
    img.src = TOPOLOGY_URL;
  });
}

// Globo terráqueo animado de fondo, puramente decorativo:
// sin etiquetas ni marcadores, no bloquea el scroll/clics.
export default function GlobeBackground({ paused }: Props) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [texture, setTexture] = useState<string | null>(null);
  // El 3D se pausa si la pestaña está oculta, el usuario prefiere movimiento
  // reducido o el modal 360° está abierto (ahorra GPU/batería).
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  );
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const shouldRotate = tabVisible && !reducedMotion && !paused;

  // La rotación se controla por ref (GlobeProps no expone autoRotate).
  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = shouldRotate;
      controls.autoRotateSpeed = 0.7;
    }
  }, [shouldRotate]);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    let alive = true;
    blueEarthTexture().then((t) => {
      if (alive && t) setTexture(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="globe-bg" aria-hidden="true">
      {texture && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={texture}
          bumpImageUrl={TOPOLOGY_URL}
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          showAtmosphere
          atmosphereColor="#7fc7bd"
          atmosphereAltitude={0.18}
        />
      )}
      <div className="globe-vignette" />
    </div>
  );
}
