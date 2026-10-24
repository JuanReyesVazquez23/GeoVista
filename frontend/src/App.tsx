import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getPagedPlaces, getPlaces, getRandomPlace } from './api/placesApi';
import { smoothScrollToId } from './scroll';
import { loadFavorites, toggleFavorite } from './favorites';
import type { PagedResult, Place } from './types';
import type { SectionId } from './navigation';
import SiteHeader from './components/SiteHeader';
import Hero from './components/Hero';
import DestinationSpotlight from './components/DestinationSpotlight';
import CatalogSection from './components/CatalogSection';
import SiteFooter from './components/SiteFooter';
import InstallPrompt from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import TourBar from './components/TourBar';
import Icon from './components/ui/Icon';

// En móvil muestra un globo 2D en canvas (el chunk 3D ni se descarga); ver GlobeBackdrop.
const GlobeBackdrop = lazy(() => import('./components/GlobeBackdrop'));
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
  // Conteo del easter egg en ref: no se renderiza, no necesita ser estado.
  const logoClicks = useRef(0);
  const logoTimer = useRef(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('gv-admin-key') ?? '');
  const [page, setPage] = useState(1);
  const [paged, setPaged] = useState<PagedResult<Place> | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);

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
    // oxlint-disable-next-line react/set-state-in-effect -- fetch con flag de cancelación (patrón recomendado por React para carreras); no es estado derivable en render.
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

  // Easter egg: 10 clics en el logo abren el panel admin (el conteo vive en
  // ref y el reseteo en el propio handler: sin efecto, sin re-render por clic).
  const onLogoClick = useCallback(() => {
    // La marca también vuelve al inicio; el décimo clic abre el panel admin.
    smoothScrollToId('inicio', { duration: 700, block: 'start' });
    window.clearTimeout(logoTimer.current);
    logoClicks.current += 1;
    if (logoClicks.current >= 10) {
      logoClicks.current = 0;
      setAdminOpen(true);
      return;
    }
    logoTimer.current = window.setTimeout(() => {
      logoClicks.current = 0;
    }, 2500);
  }, []);

  useEffect(() => () => window.clearTimeout(logoTimer.current), []);

  const changeAdminKey = useCallback((key: string) => {
    setAdminKey(key);
    if (key) sessionStorage.setItem('gv-admin-key', key);
    else sessionStorage.removeItem('gv-admin-key');
  }, []);

  // Estable para que el focus trap del modal no se reinicie en cada render.
  const closeAdmin = useCallback(() => {
    // Al salir se olvida la clave: reabrir exige autenticarse de nuevo.
    setAdminOpen(false);
    changeAdminKey('');
  }, [changeAdminKey]);

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
    // Paginación: 700 ms con offset del nav sticky.
    smoothScrollToId('lugares', { duration: 700, offset: -80 });
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
      const next = tour.index + dir;
      // Al pasar la última parada el tour se detiene (en vez de rebotar en un
      // efecto): el autoplay deja de programar timers al ver playing=false.
      if (next >= tour.queue.length) {
        setTour({ ...tour, playing: false });
        return;
      }
      const index = Math.max(0, next);
      setTour({ ...tour, index });
      setSelected(tour.queue[index]);
      setImmersive(tour.queue[index]);
    },
    [tour],
  );

  const toggleTour = useCallback(() => {
    setTour((t) => (t ? { ...t, playing: !t.playing } : t));
  }, []);

  // Autoplay del tour: solo programa el siguiente salto; la parada final la
  // gestiona goTour (playing=false), así el efecto no hace setState síncrono.
  useEffect(() => {
    if (!tour?.playing || !immersive) return;
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

  const exploreRandom = useCallback(
    async (immersiveToo = false) => {
      setSpinning(true);
      setExploreError(null);
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
          // Explorar: 950 ms centrado, efecto cinematográfico tras el "slot machine".
          smoothScrollToId('destino', { duration: 950, block: 'center' });
        }
      } catch (error) {
        setExploreError(
          error instanceof ApiError
            ? error.message
            : 'No se pudo buscar un destino. Revisa tu conexión e inténtalo de nuevo.',
        );
      } finally {
        setSpinning(false);
      }
    },
    [category],
  );

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(places.map((p) => p.category))).sort()],
    [places],
  );
  const visible =
    category === 'Todas' ? places : places.filter((p) => p.category === category);

  const goToSection = useCallback((id: SectionId) => {
    if (id === 'lugares') smoothScrollToId('lugares', { duration: 800, offset: -80 });
    else if (id === 'destino') smoothScrollToId('destino', { duration: 800, block: 'center' });
    else smoothScrollToId('inicio', { duration: 800, block: 'start' });
  }, []);

  const chooseCategory = useCallback((next: string) => {
    setCategory(next);
    setFavOnly(false);
    setPage(1);
    setExploreError(null);
  }, []);

  const toggleFavoritesFilter = useCallback(() => {
    setFavOnly((value) => !value);
    setPage(1);
    setExploreError(null);
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFavOnly(false);
    setQuery('');
    setPage(1);
    setExploreError(null);
  }, []);

  const openSelected = useCallback(() => {
    if (selected) setImmersive(selected);
  }, [selected]);

  const toggleSelectedFav = useCallback(() => {
    if (selected) toggleFav(selected.id);
  }, [selected, toggleFav]);

  return (
    <div className="app">
      <a className="skip-link" href="#lugares">
        Saltar al catálogo
      </a>

      <Suspense fallback={<div className="globe-fallback" aria-hidden="true" />}>
        <GlobeBackdrop paused={immersive !== null || !heroVisible} />
      </Suspense>

      <div className="grain" aria-hidden="true" />

      <SiteHeader onLogoClick={onLogoClick} onNavigate={goToSection} />

      <main>
        <Hero
          categories={categories}
          category={category}
          favOnly={favOnly}
          favoritesCount={favorites.length}
          placesCount={places.length}
          loading={loading}
          spinning={spinning}
          onExplore={() => exploreRandom(false)}
          onTour={startTour}
          onCategory={chooseCategory}
          onToggleFavorites={toggleFavoritesFilter}
          onScrollToPlaces={() => goToSection('lugares')}
        />

        <DestinationSpotlight
          selected={selected}
          isFav={selected ? favorites.includes(selected.id) : false}
          onExplore={openSelected}
          onRandom={() => exploreRandom(false)}
          onToggleFav={toggleSelectedFav}
        />

        <CatalogSection
          paged={paged}
          loading={loading}
          page={page}
          loadingPage={loadingPage}
          category={category}
          debounced={debounced}
          favOnly={favOnly}
          query={query}
          visibleCount={visible.length}
          favorites={favorites}
          onQueryChange={handleQueryChange}
          onClearQuery={clearQuery}
          onResetFilters={resetFilters}
          onGoToPage={goToPage}
          onExplore={setImmersive}
          onToggleFav={toggleFav}
        />
      </main>

      <SiteFooter onNavigate={goToSection} />

      <InstallPrompt />
      <UpdatePrompt />

      {exploreError && (
        <div className="toast" role="alert">
          <span>{exploreError}</span>
          <button type="button" onClick={() => setExploreError(null)} aria-label="Cerrar aviso">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {adminOpen && (
        <Suspense fallback={null}>
          <AdminPanel
            places={places}
            adminKey={adminKey}
            onKeyChange={changeAdminKey}
            onSaved={reloadAll}
            onClose={closeAdmin}
          />
        </Suspense>
      )}

      {immersive && (
        <Suspense
          fallback={
            <div className="modal-overlay">
              <div className="modal-loading">
                <Icon name="globe" size={16} />
                Cargando 360°…
              </div>
            </div>
          }
        >
          <ExploreModal
            key={immersive.id}
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
