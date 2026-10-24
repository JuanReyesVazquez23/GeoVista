import type { PagedResult, Place } from '../types';
import PlaceCard from './PlaceCard';
import Icon from './ui/Icon';

interface Props {
  paged: PagedResult<Place> | null;
  loading: boolean;
  page: number;
  loadingPage: boolean;
  category: string;
  debounced: string;
  favOnly: boolean;
  query: string;
  visibleCount: number;
  favorites: string[];
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onResetFilters: () => void;
  onGoToPage: (page: number) => void;
  onExplore: (place: Place) => void;
  onToggleFav: (id: string) => void;
}

export default function CatalogSection({
  paged,
  loading,
  page,
  loadingPage,
  category,
  debounced,
  favOnly,
  query,
  visibleCount,
  favorites,
  onQueryChange,
  onClearQuery,
  onResetFilters,
  onGoToPage,
  onExplore,
  onToggleFav,
}: Props) {
  const total = paged?.totalCount ?? visibleCount;
  const summary = `${total} destinos${
    category !== 'Todas' ? ` de ${category.toLowerCase()}` : ' del mundo'
  } esperándote.`;

  return (
    <section id="lugares" className="lugares">
      <div className="section-head">
        <div className="section-heading">
          <p className="eyebrow">
            <span className="eyebrow-mark" aria-hidden="true" />
            El atlas
          </p>
          <h2>Lugares del mundo</h2>
          <p className="section-sub">{summary}</p>
        </div>

        <div className="catalog-tools">
          <div className="searchbar" role="search">
            <Icon name="search" size={15} />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Busca un destino, país o categoría…"
              aria-label="Buscar destinos"
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={onClearQuery}
                aria-label="Limpiar búsqueda"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && !paged ? (
        <div className="state-panel">
          <p className="loading">
            <span className="loading-dot" aria-hidden="true" />
            Cargando el planeta…
          </p>
        </div>
      ) : (
        <>
          {paged && paged.totalCount === 0 ? (
            <div className="state-panel">
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  <Icon name={favOnly ? 'heart' : 'search'} size={24} />
                </span>
                {favOnly ? (
                  <>
                    <h3 className="empty-title">Aún no tienes favoritos</h3>
                    <p className="empty-text">
                      Toca el corazón de un lugar para guardarlo aquí y volver cuando quieras.
                    </p>
                    <button type="button" className="btn btn-ghost" onClick={onResetFilters}>
                      Explorar el catálogo
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="empty-title">Sin resultados</h3>
                    <p className="empty-text">
                      No encontramos nada para “{debounced}”. Prueba con otro destino, país o
                      categoría.
                    </p>
                    <button type="button" className="btn btn-ghost" onClick={onClearQuery}>
                      Limpiar búsqueda
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid" aria-busy={loadingPage}>
              {(paged?.items ?? []).map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  onExplore={onExplore}
                  isFav={favorites.includes(place.id)}
                  onToggleFav={onToggleFav}
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
                onClick={() => onGoToPage(page - 1)}
              >
                ← Anterior
              </button>
              {Array.from({ length: paged.totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`page-num${n === page ? ' active' : ''}`}
                  disabled={loadingPage}
                  onClick={() => onGoToPage(n)}
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
                onClick={() => onGoToPage(page + 1)}
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
  );
}
