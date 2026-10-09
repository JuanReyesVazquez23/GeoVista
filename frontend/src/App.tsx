import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getPagedPlaces, getPlaces, getRandomPlace } from './api/placesApi';
import { loadFavorites, toggleFavorite } from './favorites';
import type { PagedResult, Place } from './types';
import PlaceCard from './components/PlaceCard';
import PlaceImage from './components/PlaceImage';
import InstallPrompt from './components/InstallPrompt';
import TourBar from './components/TourBar';

const GlobeBackground = lazy(() => import('./components/GlobeBackground'));
// El modal (y framer-motion con él) solo se descarga al abrir el 360°.
const ExploreModal = lazy(() => import('./components/ExploreModal'));
// El panel admin también va en lazy: solo lo descarga quien lo abre.
const AdminPanel = lazy(() => import('./components/AdminPanel'));

const PAGE_SIZE = 9;
const TOUR_STOPS = 5;
const TOUR_STEP_MS = 15000;

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Place | null>(null);
  const [immersive, setImmersive] = useState<Place | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [category, setCategory] = useState<string>('Todas');
  const [favOnly, setFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [heroVisible, setHeroVisible] = useState(true);
  const [tour, setTour] = useState<{ queue: Place[]; index: number; playing: boolean } | null>(null);
  const [logoClicks, setLogoClicks] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('gv-admin-key') ?? '');
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

  // El grid pagina en servidor (?page=&pageSize=&category=&q=), salvo en modo
  // favoritos, que pagina el catálogo local ya cargado.
  // La búsqueda espera 300 ms tras la última tecla (debounce).
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

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
      getPagedPlaces(
        page,
        PAGE_SIZE,
        category === 'Todas' ? undefined : category,
        debounced || undefined,
      )
        .then(finish)
        .finally(() => {
          if (!cancelled) setLoadingPage(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [page, category, favOnly, places, favorites, debounced]);

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

  // Easter egg: 10 clics en el logo abren el panel admin (el conteo resetea tras 2.5 s).
  useEffect(() => {
    if (logoClicks === 0) return;
    if (logoClicks >= 10) {
      setLogoClicks(0);
      setAdminOpen(true);
      return;
    }
    const timer = window.setTimeout(() => setLogoClicks(0), 2500);
    return () => window.clearTimeout(timer);
  }, [logoClicks]);

  const changeAdminKey = useCallback((key: string) => {
    setAdminKey(key);
    if (key) sessionStorage.setItem('gv-admin-key', key);
    else sessionStorage.removeItem('gv-admin-key');
  }, []);

  // Tras alta/baja/edición: recarga catálogo + primera página del grid.
  const reloadAll = useCallback(async () => {
    const fresh = await getPlaces();
    setPlaces(fresh);
    setPage(1);
    setPaged(
      await getPagedPlaces(
        1,
        PAGE_SIZE,
        category === 'Todas' ? undefined : category,
        debounced || undefined,
      ),
    );
  }, [category, debounced]);

  const goToPage = (n: number) => {
    setPage(n);
    document.getElementById('lugares')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Modo tour: cola de paradas con autoplay; respeta la categoría elegida.
  const exitTour = useCallback(() => setTour(null), []);

  const startTour = useCallback(() => {
    const pool = category === 'Todas' ? places : places.filter((p) => p.category === category);
    const queue = [...pool].sort(() => Math.random() - 0.5).slice(0, TOUR_STOPS);
    if (queue.length === 0) return;
    setTour({ queue, index: 0, playing: true });
    setSelected(queue[0]);
    setImmersive(queue[0]);
  }, [places, category]);

  const goTour = useCallback(
    (dir: 1 | -1) => {
      if (!tour) return;
      const index = Math.min(tour.queue.length - 1, Math.max(0, tour.index + dir));
      setTour({ ...tour, index });
      setSelected(tour.queue[index]);
      setImmersive(tour.queue[index]);
    },
    [tour],
  );

  const toggleTour = useCallback(() => {
    setTour((t) => (t ? { ...t, playing: !t.playing } : t));
  }, []);

  useEffect(() => {
    if (!tour?.playing || !immersive) return;
    if (tour.index >= tour.queue.length - 1) {
      setTour({ ...tour, playing: false });
      return;
    }
    const timer = window.setTimeout(() => goTour(1), TOUR_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [tour, immersive, goTour]);

  const closeImmersive = useCallback(() => {
    exitTour();
    setImmersive(null);
  }, [exitTour]);

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
          <img
            src="/logo.svg"
            className="brand-logo"
            alt="GeoVista"
            width="32"
            height="32"
            title="GeoVista"
            style={{ cursor: 'pointer' }}
            onClick={() => setLogoClicks((c) => c + 1)}
          />
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
            <button
              type="button"
              className="btn btn-ghost btn-xl"
              onClick={startTour}
              disabled={loading || places.length === 0}
            >
              🗺 Tour 360°
            </button>
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
               Tu próximo destino aparecerá aquí. Pulsa <strong>Explorar</strong> para empezar
              la aventura.
            </p>
          )}
        </section>

        <section id="lugares" className="lugares">
          <div className="section-head">
            <h2>Lugares del mundo</h2>
            <p>{paged?.totalCount ?? visible.length} destinos{category !== 'Todas' ? ` de ${category.toLowerCase()}` : ' del mundo'} esperándote.</p>
            <div className="searchbar" role="search">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Busca un destino, país o categoría…"
                aria-label="Buscar destinos"
              />
              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                  }}
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {loading && !paged ? (
            <p className="loading">🌐 Cargando el planeta…</p>
          ) : (
            <>
              {paged && paged.totalCount === 0 ? (
                favOnly ? (
                  <p className="loading">🤍 Aún no tienes favoritos — toca el ♥ de un lugar para guardarlo aquí.</p>
                ) : (
                  <p className="loading">🔍 Sin resultados para “{debounced}”. Prueba con otro destino.</p>
                )
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

      {adminOpen && (
        <Suspense fallback={null}>
          <AdminPanel
            places={places}
            adminKey={adminKey}
            onKeyChange={changeAdminKey}
            onSaved={reloadAll}
            onClose={() => setAdminOpen(false)}
          />
        </Suspense>
      )}

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
            onClose={closeImmersive}
            onRandom={() => {
              exitTour();
              exploreRandom(true);
            }}
          />
        </Suspense>
      )}

      {tour && immersive && (
        <TourBar
          current={tour.index + 1}
          total={tour.queue.length}
          placeName={tour.queue[tour.index].name}
          playing={tour.playing}
          stepMs={TOUR_STEP_MS}
          onPrev={() => goTour(-1)}
          onNext={() => goTour(1)}
          onToggle={toggleTour}
          onExit={exitTour}
        />
      )}
    </div>
  );
}
