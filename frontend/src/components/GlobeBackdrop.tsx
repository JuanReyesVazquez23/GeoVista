import { lazy, Suspense, useEffect, useState } from 'react';

const GlobeBackground = lazy(() => import('./GlobeBackground'));

// Móvil = pantalla pequeña o táctil pequeña. Los touch-laptops de escritorio
// quedan fuera (coarse + pantalla grande → globo 3D normal).
function isMobileGlobe(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(max-width: 640px)').matches ||
    (window.matchMedia('(pointer: coarse)').matches &&
      window.matchMedia('(max-width: 1024px)').matches)
  );
}

interface Props {
  paused?: boolean;
}

// En móvil muestra un póster CSS estático: el chunk de three.js (~2 MB)
// ni siquiera se descarga. En escritorio, el globo 3D en lazy como antes.
export default function GlobeBackdrop({ paused }: Props) {
  const [mobile, setMobile] = useState(isMobileGlobe);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setMobile(isMobileGlobe());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (mobile) {
    return (
      <div className="globe-bg" aria-hidden="true">
        <div className="globe-poster" />
        <div className="globe-vignette" />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="globe-fallback" aria-hidden="true" />}>
      <GlobeBackground paused={paused} />
    </Suspense>
  );
}
