import { useEffect, useMemo, useState } from 'react';
import Globe from 'react-globe.gl';
import type { Place } from '../types';

interface Props {
  places: Place[];
  highlight?: Place | null;
  onSelect?: (place: Place) => void;
  // Pausa la rotación (p. ej. cuando el modal 360° está abierto).
  paused?: boolean;
}

interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
  place: Place;
}

// Globo terráqueo animado de fondo (rota solo, no bloquea el scroll/clics).
export default function GlobeBackground({ places, highlight, onSelect, paused }: Props) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
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

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const points: GlobePoint[] = useMemo(
    () =>
      places.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        size: highlight?.id === p.id ? 1.1 : 0.55,
        color: highlight?.id === p.id ? '#22d3ee' : '#f472b6',
        label: `${p.name} — ${p.country}`,
        place: p,
      })),
    [places, highlight],
  );

  return (
    <div className="globe-bg" aria-hidden="true">
      <Globe
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere
        atmosphereColor="#38bdf8"
        atmosphereAltitude={0.2}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.02}
        pointRadius="size"
        pointColor="color"
        labelsData={points}
        labelLat="lat"
        labelLng="lng"
        labelText="label"
        labelSize={1.4}
        labelDotRadius={0.4}
        labelColor={() => 'rgba(226, 232, 240, 0.85)'}
        autoRotate={tabVisible && !reducedMotion && !paused}
        autoRotateSpeed={0.7}
        // @ts-expect-error firma amplia de react-globe.gl
        onPointClick={(p: GlobePoint) => onSelect?.(p.place)}
        // @ts-expect-error firma amplia de react-globe.gl
        onLabelClick={(p: GlobePoint) => onSelect?.(p.place)}
      />
      <div className="globe-vignette" />
    </div>
  );
}
