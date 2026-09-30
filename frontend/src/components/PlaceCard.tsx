import { memo } from 'react';
import type { Place } from '../types';
import PlaceImage from './PlaceImage';

interface Props {
  place: Place;
  onExplore: (place: Place) => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}

// memo: evita re-renderizar las 35 tarjetas cuando App re-renderiza
// (spinning, modal, categoría) sin que cambien sus props.
// La entrada por scroll y el hover van por CSS (.reveal, .card:hover),
// sin medir layouts por JS en cada render.
function PlaceCard({ place, onExplore, isFav, onToggleFav }: Props) {
  return (
    <article className="card reveal">
      <div className="card-media">
        <PlaceImage place={place} w={600} loading="lazy" referrerPolicy="no-referrer" />
        <span className="chip">{place.category}</span>
        <button
          type="button"
          className={`fav-btn${isFav ? ' active' : ''}`}
          onClick={() => onToggleFav(place.id)}
          aria-pressed={isFav}
          aria-label={isFav ? `Quitar ${place.name} de favoritos` : `Guardar ${place.name} en favoritos`}
        >
          {isFav ? '♥' : '♡'}
        </button>
      </div>
      <div className="card-body">
        <h3>{place.name}</h3>
        <p className="card-country">{place.country}</p>
        <p className="card-desc">{place.description}</p>
        <p className="card-coords">
          {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
        </p>
        <div className="card-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onExplore(place)}>
            {place.hasStreetView === false ? 'Explorar' : 'Explorar 360°'}
          </button>
          <a
            className="btn btn-ghost btn-sm"
            href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Maps
          </a>
        </div>
      </div>
    </article>
  );
}

export default memo(PlaceCard);
