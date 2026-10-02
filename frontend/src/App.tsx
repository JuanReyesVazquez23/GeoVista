import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getPagedPlaces, getPlaces, getRandomPlace } from './api/placesApi';
import { loadFavorites, toggleFavorite } from './favorites';
import type { PagedResult, Place } from './types';
import PlaceCard from './components/PlaceCard';
import PlaceImage from './components/PlaceImage';
import InstallPrompt from './components/InstallPrompt';

const GlobeBackground = lazy(() => import('./components/GlobeBackground'));
// El modal (y framer-motion con él) solo se descarga al abrir el 360°.
const ExploreModal = lazy(() => import('./components/ExploreModal'));

const PAGE_SIZE = 9;

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Place | null>(null);
  const [immersive, setImmersive] = useState<Place | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [category, setCategory] = useState<string>('Todas');
  const [favOnly, setFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [heroVisible, setHeroVisible] = useState(true);
  const [page, setPage] = useState(1);
  const [paged, setPaged] = useState<PagedResult<Place> | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);

  useEffect(() => {
    getPlaces()
      .then(setPlaces)
      .finally(() => setLoading(false));
  }, []);

  const toggleFav = useCallback((id: string) => {
    setFavorites((prev) => toggleFavorite(prev, id));
  }, []);

  // El grid pagina en servidor (?page=&pageSize=&category=), salvo en modo
  // favoritos, que pagina el catálogo local ya cargado.
  useEffect(() => {
    let cancelled = false;
    setLoadingPage(true);
    const finish = (r: PagedResult<Place>) => {
      if (!cancelled) setPaged(r);
    };
    if (favOnly) {
      const pool = places.filter((p) => favorites.includes(p.id));
      const totalPages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      if (safePage !== page) setPage(safePage);
      finish({
        items: pool.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        page: safePage,
        pageSize: PAGE_SIZE,
        totalCount: pool.length,
        totalPages,
      });
      if (!cancelled) setLoadingPage(false);
    } else {
      getPagedPlaces(page, PAGE_SIZE, category === 'Todas' ? undefined : category)
        .then(finish)
        .finally(() => {
          if (!cancelled) setLoadingPage(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [page, category, favOnly, places, favorites]);

  // SEO dinámico: título y descripción según el destino abierto.
  useEffect(() => {
    const fallback =
      'GeoVista — Descubre lugares del mundo al azar: monumentos, plazas, paisajes y montañas. Explóralos en 360°.';
    const current = immersive ?? selected;
    document.title = current
      ? `${current.name} · ${current.country} | GeoVista`
      : 'GeoVista — Descubre el mundo al azar';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', current ? `${current.description} Explóralo en 360° con GeoVista.` : fallback);
  }, [immersive, selected]);

  const goToPage = (n: number) => {
    setPage(n);
    document.getElementById('lugares')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // El globo solo anima mientras el hero está en pantalla: fuera de vista
  // seguiría gastando GPU tras el contenido.
  useEffect(() => {
    const el = document.getElementById('inicio');
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
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
        <GlobeBackground paused={immersive !== null || !heroVisible} />
      </Suspense>

      <div className="grain" aria-hidden="true" />

      <header className="nav">
        <div className="brand">
          <img src="/logo.svg" className="brand-logo" alt="GeoVista" width="32" height="32" />
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
                className={`pill${c === category && !favOnly ? ' active' : ''}`}
                onClick={() => { setCategory(c); setFavOnly(false); setPage(1); }}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              className={`pill${favOnly ? ' active' : ''}`}
              onClick={() => { setFavOnly((v) => !v); setPage(1); }}
              aria-pressed={favOnly}
            >
              ♥ Favoritos{favorites.length > 0 ? ` (${favorites.length})` : ''}
            </button>
          </div>
          <p className="hero-meta anim" style={{ animationDelay: '0.5s' }}>
            {loading ? 'Preparando tu viaje…' : `${places.length} destinos alrededor del mundo`}
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
                      {selected.hasStreetView === false ? 'Ver galería' : 'Vivir experiencia 360°'}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => exploreRandom(false)}>
                      Otro destino
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => toggleFav(selected.id)}
                      aria-pressed={favorites.includes(selected.id)}
                    >
                      {favorites.includes(selected.id) ? '♥ En favoritos' : '♡ Guardar'}
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
            <p>{paged?.totalCount ?? visible.length} destinos{category !== 'Todas' ? ` de ${category.toLowerCase()}` : ' del mundo'} esperándote.</p>
          </div>
          {loading && !paged ? (
            <p className="loading">🌐 Cargando el planeta…</p>
          ) : (
            <>
              {favOnly && paged && paged.totalCount === 0 ? (
                <p className="loading">🤍 Aún no tienes favoritos — toca el ♥ de un lugar para guardarlo aquí.</p>
              ) : (
              <div className="grid">
                {(paged?.items ?? []).map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    onExplore={setImmersive}
                    isFav={favorites.includes(place.id)}
                    onToggleFav={toggleFav}
                  />
                ))}
              </div>
              )}
              {paged && paged.totalPages > 1 && (
                <nav className="pagination" aria-label="Paginación de lugares">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={page <= 1 || loadingPage}
                    onClick={() => goToPage(page - 1)}
                  >
                    ← Anterior
                  </button>
                  {Array.from({ length: paged.totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`page-num${n === page ? ' active' : ''}`}
                      disabled={loadingPage}
                      onClick={() => goToPage(n)}
                      aria-label={`Página ${n}`}
                      aria-current={n === page ? 'page' : undefined}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={page >= paged.totalPages || loadingPage}
                    onClick={() => goToPage(page + 1)}
                  >
                    Siguiente →
                  </button>
                </nav>
              )}
              {paged && paged.totalCount > 0 && (
                <p className="page-info">
                  Página {paged.page} de {paged.totalPages} · {paged.totalCount} destinos
                </p>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>
          <strong>GeoVista</strong> · Descubre el mundo, un destino a la vez.
        </p>
      </footer>

      <InstallPrompt />

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
