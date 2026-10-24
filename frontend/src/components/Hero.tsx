import CategoryFilter from './CategoryFilter';
import Icon from './ui/Icon';

interface Props {
  categories: string[];
  category: string;
  favOnly: boolean;
  favoritesCount: number;
  placesCount: number;
  loading: boolean;
  spinning: boolean;
  onExplore: () => void;
  onTour: () => void;
  onCategory: (category: string) => void;
  onToggleFavorites: () => void;
  onScrollToPlaces: () => void;
}

export default function Hero({
  categories,
  category,
  favOnly,
  favoritesCount,
  placesCount,
  loading,
  spinning,
  onExplore,
  onTour,
  onCategory,
  onToggleFavorites,
  onScrollToPlaces,
}: Props) {
  return (
    <section id="inicio" className="hero">
      <div className="hero-shell">
        <div className="hero-copy">
          <p className="eyebrow anim">
            <span className="eyebrow-mark" aria-hidden="true" />
            Edición 2026
          </p>

          <h1 className="anim" style={{ animationDelay: '0.08s' }}>
            <span className="display-line">Descubre el mundo</span>
            <span className="display-line">
              <em>al azar</em>
            </span>
          </h1>

          <p className="lede anim" style={{ animationDelay: '0.16s' }}>
            Una colección de lugares para perderte sin itinerario. Pulsa{' '}
            <strong>Explorar</strong> y viaja a un rincón del planeta con fotografía,
            coordenadas y vista 360°.
          </p>

          <div className="hero-actions anim" style={{ animationDelay: '0.24s' }}>
            <button
              type="button"
              className={`btn btn-primary btn-xl magnetic${spinning ? ' is-spinning' : ''}`}
              onClick={onExplore}
              disabled={spinning || loading}
            >
              <Icon name={spinning ? 'globe' : 'compass'} size={17} />
              {spinning
                ? 'Buscando destino…'
                : category === 'Todas'
                  ? 'Explorar un destino'
                  : `Explorar ${category.toLowerCase()}`}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xl"
              onClick={onTour}
              disabled={loading || placesCount === 0}
            >
              <Icon name="play" size={14} />
              Tour 360°
            </button>
            <button type="button" className="btn btn-text btn-xl" onClick={onScrollToPlaces}>
              <Icon name="arrow-down" size={15} />
              Ver el atlas
            </button>
          </div>

          <div className="anim" style={{ animationDelay: '0.32s' }}>
            <CategoryFilter
              categories={categories}
              category={category}
              favOnly={favOnly}
              favoritesCount={favoritesCount}
              onCategory={onCategory}
              onToggleFavorites={onToggleFavorites}
            />
          </div>

          <p className="hero-meta anim" style={{ animationDelay: '0.4s' }}>
            {loading ? 'Preparando tu viaje…' : `${placesCount} destinos alrededor del mundo`}
          </p>
        </div>
      </div>
    </section>
  );
}
