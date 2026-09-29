import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getPlaces, getRandomPlace } from './api/placesApi';
import type { Place } from './types';
import PlaceCard from './components/PlaceCard';
import PlaceImage from './components/PlaceImage';

const GlobeBackground = lazy(() => import('./components/GlobeBackground'));
// El modal (y framer-motion con él) solo se descarga al abrir el 360°.
const ExploreModal = lazy(() => import('./components/ExploreModal'));

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Place | null>(null);
  const [immersive, setImmersive] = useState<Place | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [category, setCategory] = useState<string>('Todas');

  useEffect(() => {
    getPlaces()
      .then(setPlaces)
      .finally(() => setLoading(false));
  }, []);

  const exploreRandom = useCallback(async (immersiveToo = false) => {
    setSpinning(true);
    try {
      // Explorar respeta la categoría elegida: /api/places/random?category= (o filtro local).
      const place = await getRandomPlace(category === 'Todas' ? undefined : category);
      // Pequeña pausa cinematográfica para el efecto "slot machine".
      await new Promise((r) => setTimeout(r, 450));
      setSelected(place);
      if (immersiveToo) {
        setImmersive(place);
      } else {
        // Con el modal abierto no se hace scroll del fondo (trabajo inútil).
        document.getElementById('destino')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } finally {
      setSpinning(false);
    }
  }, [category]);

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(places.map((p) => p.category))).sort()],
    [places],
  );
  const visible =
    category === 'Todas' ? places : places.filter((p) => p.category === category);

  return (
    <div className="app">
      <Suspense fallback={<div className="globe-fallback" aria-hidden="true" />}>
        <GlobeBackground
          places={places}
          highlight={selected}
          onSelect={setSelected}
          paused={immersive !== null}
        />
      </Suspense>

      <div className="grain" aria-hidden="true" />

      <header className="nav">
        <div className="brand">
          <span className="brand-globe">🌍</span>
          <span className="brand-name">GeoVista</span>
        </div>
        <nav className="nav-links">
          <a href="#inicio">Inicio</a>
          <a href="#lugares">Lugares</a>
          <a href="#destino">Explorar</a>
        </nav>
      </header>

      <main>
        <section id="inicio" className="hero">
          <p className="eyebrow anim">
            Monumentos · Plazas · Paisajes · Montañas
          </p>
          <h1 className="anim" style={{ animationDelay: '0.1s' }}>
            Descubre el mundo
            <span className="gradient"> al azar</span>
          </h1>
          <p className="lede anim" style={{ animationDelay: '0.2s' }}>
            Pulsa <strong>Explorar</strong> y GeoVista te teletransporta a un rincón del planeta
            con foto en línea, coordenadas de Google Maps y vista 360° con Street View.
          </p>
          <div className="hero-cta anim" style={{ animationDelay: '0.3s' }}>
            <button
              type="button"
              className={`btn btn-primary btn-xl magnetic${spinning ? ' is-spinning' : ''}`}
              onClick={() => exploreRandom(false)}
              disabled={spinning || loading}
            >
              {spinning ? '🛰️ Viajando…' : category === 'Todas' ? '🎲 Explorar' : `🎲 Explorar · ${category}`}
            </button>
            <a href="#lugares" className="btn btn-ghost btn-xl">
              Ver lugares
            </a>
          </div>
          <div
            className="pills anim"
            style={{ animationDelay: '0.4s' }}
            role="group"
            aria-label="Explorar por categoría"
          >
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={`pill${c === category ? ' active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="hero-meta anim" style={{ animationDelay: '0.5s' }}>
            {loading ? 'Cargando lugares…' : `${places.length} destinos · API ASP.NET Core · Imágenes en línea`}
          </p>
        </section>

        <section id="destino" className="destino">
          {selected ? (
            <div key={selected.id} className="destino-card glass destino-enter">
                <PlaceImage place={selected} loading="lazy" referrerPolicy="no-referrer" />
                <div>
                  <span className="chip">{selected.category}</span>
                  <h2>{selected.name}</h2>
                  <p className="card-country">{selected.country}</p>
                  <p>{selected.description}</p>
                  <p className="card-coords">
                    📍 {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                  </p>
                  <div className="card-actions">
                    <button type="button" className="btn btn-primary" onClick={() => setImmersive(selected)}>
                      Vivir experiencia 360°
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => exploreRandom(false)}>
                      Otro destino
                    </button>
                  </div>
                </div>
            </div>
          ) : (
            <p className="destino-empty glass">
              ✨ Tu próximo destino aparecerá aquí. Pulsa <strong>Explorar</strong> para empezar
              la aventura.
            </p>
          )}
        </section>

        <section id="lugares" className="lugares">
          <div className="section-head">
            <h2>Lugares del mundo</h2>
            <p>Datos servidos por <code>GET /api/places</code> · {visible.length} destinos{category !== 'Todas' ? ` · ${category}` : ''} · fotos remotas sin descargas.</p>
          </div>
          {loading ? (
            <p className="loading">🌐 Cargando el planeta…</p>
          ) : (
            <div className="grid">
              {(selected ? [selected, ...visible.filter((p) => p.id !== selected.id)] : visible).map(
                (place) => (
                  <PlaceCard key={place.id} place={place} onExplore={setImmersive} />
                ),
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>
          <strong>GeoVista</strong> · React + TypeScript · ASP.NET Core · Próximo: búsqueda,
          categorías y favoritos.
        </p>
      </footer>

      {immersive && (
        <Suspense
          fallback={
            <div className="modal-overlay">
              <p className="loading">🌐 Cargando 360°…</p>
            </div>
          }
        >
          <ExploreModal
            place={immersive}
            onClose={() => setImmersive(null)}
            onRandom={() => exploreRandom(true)}
          />
        </Suspense>
      )}
    </div>
  );
}
